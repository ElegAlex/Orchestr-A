import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { OwnershipService } from '../common/services/ownership.service';
import { PermissionsService } from '../rbac/permissions.service';
import { AccessScopeService } from '../common/services/access-scope.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ProjectStatus,
  TaskStatus,
  MilestoneStatus,
} from '../__mocks__/database';
import { ArchivedFilter } from './dto/archived-filter.dto';

describe('ProjectsService', () => {
  let service: ProjectsService;

  const mockPrismaService = {
    project: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    projectMember: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    task: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    document: {
      count: vi.fn(),
    },
    timeEntry: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    projectSnapshot: {
      create: vi.fn(),
      upsert: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    projectClient: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    client: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    description: 'Test Description',
    code: 'TEST-001',
    status: ProjectStatus.ACTIVE,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    budgetHours: 1000,
    managerId: 'manager-1',
    departmentId: 'dept-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [],
    epics: [],
    milestones: [],
    tasks: [],
    clients: [],
    _count: { members: 0, tasks: 0, epics: 0, milestones: 0 },
  };

  const mockUser = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.com',
    role: 'CONTRIBUTEUR',
  };

  const mockOwnershipService = {
    isOwner: vi.fn(),
  };

  const mockPermissionsService = {
    getPermissionsForRole: vi.fn(),
  };

  const mockAuditPersistenceService = {
    log: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: OwnershipService,
          useValue: mockOwnershipService,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
        {
          provide: AccessScopeService,
          useValue: {
            projectAccessWhere: vi.fn().mockResolvedValue({}),
            assertCanAccessProject: vi.fn().mockResolvedValue(undefined),
            hasAny: vi.fn().mockResolvedValue(true),
          },
        },
        {
          provide: AuditPersistenceService,
          useValue: mockAuditPersistenceService,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // CREATE
  // ============================================
  describe('create', () => {
    const createProjectDto = {
      name: 'Test Project',
      description: 'Test Description',
      code: 'TEST-001',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      managerId: 'manager-1',
      departmentId: 'dept-1',
    };
    const creatorId = 'creator-user-id';

    // Helper to setup transaction mock
    const setupTransactionMock = (
      projectToReturn: typeof mockProject | null,
    ) => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          project: {
            create: vi
              .fn()
              .mockResolvedValue({ ...mockProject, id: 'new-project-id' }),
            findUnique: vi.fn().mockResolvedValue(projectToReturn),
          },
          projectMember: {
            create: vi.fn().mockResolvedValue({
              id: 'member-1',
              projectId: 'new-project-id',
              userId: creatorId,
              role: 'Chef de projet',
              allocation: 100,
            }),
          },
        };
        return callback(tx);
      });
    };

    it('should create a project successfully and add creator as member', async () => {
      setupTransactionMock(mockProject);

      const result = await service.create(createProjectDto, creatorId);

      expect(result).toBeDefined();
      expect(result!.name).toBe('Test Project');
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when end date is before start date', async () => {
      const invalidDto = {
        ...createProjectDto,
        startDate: '2025-12-31',
        endDate: '2025-01-01',
      };

      await expect(service.create(invalidDto, creatorId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow same-day project (startDate === endDate)', async () => {
      const sameDayDto = {
        ...createProjectDto,
        startDate: '2025-06-04',
        endDate: '2025-06-04',
      };

      setupTransactionMock({
        ...mockProject,
        startDate: new Date('2025-06-04'),
        endDate: new Date('2025-06-04'),
      });

      const result = await service.create(sameDayDto, creatorId);
      expect(result).toBeDefined();
    });

    it('should create project without dates', async () => {
      const dtoWithoutDates = {
        name: 'Test Project',
        description: 'Test Description',
        code: 'TEST-001',
      };

      setupTransactionMock({ ...mockProject, startDate: null, endDate: null });

      const result = await service.create(dtoWithoutDates, creatorId);

      expect(result).toBeDefined();
    });

    it('should use DRAFT status by default', async () => {
      const dtoWithoutStatus = { ...createProjectDto };
      setupTransactionMock({ ...mockProject, status: ProjectStatus.DRAFT });

      await service.create(dtoWithoutStatus, creatorId);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should use provided status', async () => {
      const dtoWithStatus = {
        ...createProjectDto,
        status: ProjectStatus.ACTIVE,
      };
      setupTransactionMock({ ...mockProject, status: ProjectStatus.ACTIVE });

      await service.create(dtoWithStatus, creatorId);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  // ============================================
  // FIND ALL
  // ============================================
  describe('findAll', () => {
    beforeEach(() => {
      // After PER-005 fix: progress is computed via task.groupBy, not per-row tasks include.
      // Default to empty array so existing tests don't throw on undefined.
      mockPrismaService.task.groupBy.mockResolvedValue([]);
    });

    it('should return paginated projects', async () => {
      const mockProjects = [mockProject];
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);
      mockPrismaService.project.count.mockResolvedValue(1);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('should filter by status', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.project.count.mockResolvedValue(1);

      await service.findAll(1, 10, ProjectStatus.ACTIVE);

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ProjectStatus.ACTIVE, archivedAt: null },
        }),
      );
    });

    it('should handle empty status filter', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(0);

      await service.findAll(1, 10);

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { archivedAt: null },
        }),
      );
    });

    it('should calculate correct pagination', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(25);

      const result = await service.findAll(2, 10);

      expect(result.meta.totalPages).toBe(3);
      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    // ------------------------------------------
    // Visibilité par rôle RBAC
    // ------------------------------------------
    describe('role-based visibility', () => {
      const projectA = { ...mockProject, id: 'project-a', tasks: [] };
      const projectB = {
        ...mockProject,
        id: 'project-b',
        name: 'Secret Project',
        tasks: [],
      };

      const withManageAny = () =>
        mockPermissionsService.getPermissionsForRole.mockResolvedValue([
          'projects:manage_any',
        ]);
      const withoutManageAny = () =>
        mockPermissionsService.getPermissionsForRole.mockResolvedValue([]);

      it('should return ALL projects for ADMIN regardless of membership', async () => {
        withManageAny();
        mockPrismaService.project.findMany.mockResolvedValue([
          projectA,
          projectB,
        ]);
        mockPrismaService.project.count.mockResolvedValue(2);

        const result = await service.findAll(
          1,
          10,
          undefined,
          'admin-id',
          'ADMIN',
        );

        expect(result.data).toHaveLength(2);
        // Aucun filtre de membership appliqué — where ne doit pas contenir members
        expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { archivedAt: null },
          }),
        );
        expect(mockPrismaService.project.count).toHaveBeenCalledWith({
          where: { archivedAt: null },
        });
      });

      it('should return ALL projects for RESPONSABLE regardless of membership', async () => {
        withManageAny();
        mockPrismaService.project.findMany.mockResolvedValue([
          projectA,
          projectB,
        ]);
        mockPrismaService.project.count.mockResolvedValue(2);

        await service.findAll(1, 10, undefined, 'resp-id', 'RESPONSABLE');

        expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { archivedAt: null },
          }),
        );
      });

      it('should return ALL projects for MANAGER regardless of membership', async () => {
        withManageAny();
        mockPrismaService.project.findMany.mockResolvedValue([
          projectA,
          projectB,
        ]);
        mockPrismaService.project.count.mockResolvedValue(2);

        await service.findAll(1, 10, undefined, 'manager-id', 'MANAGER');

        expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { archivedAt: null },
          }),
        );
      });

      it('should filter projects by membership for CONTRIBUTEUR', async () => {
        withoutManageAny();
        mockPrismaService.project.findMany.mockResolvedValue([projectA]);
        mockPrismaService.project.count.mockResolvedValue(1);

        await service.findAll(1, 10, undefined, 'contrib-id', 'CONTRIBUTEUR');

        expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              members: { some: { userId: 'contrib-id' } },
              archivedAt: null,
            },
          }),
        );
      });

      it('should filter projects by membership for OBSERVATEUR', async () => {
        withoutManageAny();
        mockPrismaService.project.findMany.mockResolvedValue([projectA]);
        mockPrismaService.project.count.mockResolvedValue(1);

        await service.findAll(1, 10, undefined, 'obs-id', 'OBSERVATEUR');

        expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              members: { some: { userId: 'obs-id' } },
              archivedAt: null,
            },
          }),
        );
      });

      it('should filter projects by membership for REFERENT_TECHNIQUE', async () => {
        withoutManageAny();
        mockPrismaService.project.findMany.mockResolvedValue([projectA]);
        mockPrismaService.project.count.mockResolvedValue(1);

        await service.findAll(1, 10, undefined, 'ref-id', 'REFERENT_TECHNIQUE');

        expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              members: { some: { userId: 'ref-id' } },
              archivedAt: null,
            },
          }),
        );
      });

      it('should combine status filter with full visibility for ADMIN', async () => {
        withManageAny();
        mockPrismaService.project.findMany.mockResolvedValue([projectA]);
        mockPrismaService.project.count.mockResolvedValue(1);

        await service.findAll(1, 10, ProjectStatus.ACTIVE, 'admin-id', 'ADMIN');

        expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { status: ProjectStatus.ACTIVE, archivedAt: null },
          }),
        );
      });

      it('should combine status filter with membership filter for CONTRIBUTEUR', async () => {
        withoutManageAny();
        mockPrismaService.project.findMany.mockResolvedValue([projectA]);
        mockPrismaService.project.count.mockResolvedValue(1);

        await service.findAll(
          1,
          10,
          ProjectStatus.ACTIVE,
          'contrib-id',
          'CONTRIBUTEUR',
        );

        expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              status: ProjectStatus.ACTIVE,
              members: { some: { userId: 'contrib-id' } },
              archivedAt: null,
            },
          }),
        );
      });

      it('should not apply membership filter when no userId is provided', async () => {
        mockPrismaService.project.findMany.mockResolvedValue([
          projectA,
          projectB,
        ]);
        mockPrismaService.project.count.mockResolvedValue(2);

        // Appel sans userId ni rôle (rétrocompatibilité)
        await service.findAll(1, 10);

        expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { archivedAt: null },
          }),
        );
      });
    });

    // ------------------------------------------
    // Filtre clients (CSV d'UUIDs)
    // ------------------------------------------
    describe('clients filter', () => {
      const clientId1 = '550e8400-e29b-41d4-a716-446655440001';
      const clientId2 = '550e8400-e29b-41d4-a716-446655440002';

      it('should apply clients OR filter when clients param is provided', async () => {
        mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
        mockPrismaService.project.count.mockResolvedValue(1);

        await service.findAll(
          1,
          10,
          undefined,
          undefined,
          undefined,
          `${clientId1},${clientId2}`,
        );

        expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              clients: { some: { clientId: { in: [clientId1, clientId2] } } },
              archivedAt: null,
            },
          }),
        );
      });

      it('should not apply clients filter when clients param is absent', async () => {
        mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
        mockPrismaService.project.count.mockResolvedValue(1);

        await service.findAll(1, 10);

        const callArg = mockPrismaService.project.findMany.mock.calls[0][0] as {
          where: Record<string, unknown>;
        };
        expect(callArg.where).not.toHaveProperty('clients');
      });

      it('should throw BadRequestException when clients param contains invalid UUIDs', async () => {
        await expect(
          service.findAll(
            1,
            10,
            undefined,
            undefined,
            undefined,
            'not-a-uuid,also-bad',
          ),
        ).rejects.toThrow(BadRequestException);

        expect(mockPrismaService.project.findMany).not.toHaveBeenCalled();
      });

      it('should return clients enriched as flat [{id, name}] array in findAll', async () => {
        const projectWithClients = {
          ...mockProject,
          clients: [
            { client: { id: clientId1, name: 'ACME Corp' } },
            { client: { id: clientId2, name: 'Beta SA' } },
          ],
        };
        mockPrismaService.project.findMany.mockResolvedValue([
          projectWithClients,
        ]);
        mockPrismaService.project.count.mockResolvedValue(1);

        const result = await service.findAll(1, 10);

        expect(result.data[0].clients).toEqual([
          { id: clientId1, name: 'ACME Corp' },
          { id: clientId2, name: 'Beta SA' },
        ]);
      });
    });

    // ------------------------------------------
    // Filtre archived
    // ------------------------------------------
    describe('archived filter', () => {
      it('default findAll excludes archived projects (archivedAt: null)', async () => {
        mockPrismaService.project.findMany.mockResolvedValue([]);
        mockPrismaService.project.count.mockResolvedValue(0);

        await service.findAll(1, 10);
        const callArgs = mockPrismaService.project.findMany.mock.calls[0][0] as {
          where: Record<string, unknown>;
        };
        expect(JSON.stringify(callArgs.where)).toContain('"archivedAt":null');
      });

      it('archived=archived returns only archived projects', async () => {
        mockPrismaService.project.findMany.mockResolvedValue([]);
        mockPrismaService.project.count.mockResolvedValue(0);

        await service.findAll(1, 10, undefined, undefined, undefined, undefined, ArchivedFilter.ARCHIVED);
        const callArgs = mockPrismaService.project.findMany.mock.calls[0][0] as {
          where: Record<string, unknown>;
        };
        expect(JSON.stringify(callArgs.where)).toContain('"archivedAt":{"not":null}');
      });

      it('archived=all does not filter on archivedAt', async () => {
        mockPrismaService.project.findMany.mockResolvedValue([]);
        mockPrismaService.project.count.mockResolvedValue(0);

        await service.findAll(1, 10, undefined, undefined, undefined, undefined, ArchivedFilter.ALL);
        const callArgs = mockPrismaService.project.findMany.mock.calls[0][0] as {
          where: Record<string, unknown>;
        };
        expect(JSON.stringify(callArgs.where)).not.toContain('archivedAt');
      });
    });

    // ------------------------------------------
    // PER-005 — N+1 regression: tasks must be fetched via groupBy, not per-row include
    // ------------------------------------------
    describe('PER-005 — progress via groupBy (no per-row tasks include)', () => {
      it('findMany include must NOT contain tasks (avoids O(n*tasks) data pull)', async () => {
        mockPrismaService.project.findMany.mockResolvedValue([]);
        mockPrismaService.project.count.mockResolvedValue(0);

        await service.findAll(1, 10);

        const callArgs = mockPrismaService.project.findMany.mock.calls[0][0] as {
          include: Record<string, unknown>;
        };
        expect(callArgs.include).not.toHaveProperty('tasks');
      });

      it('task.groupBy is called with all project IDs on the page (single fan-out)', async () => {
        const project1 = { ...mockProject, id: 'p-1' };
        const project2 = { ...mockProject, id: 'p-2' };
        mockPrismaService.project.findMany.mockResolvedValue([project1, project2]);
        mockPrismaService.project.count.mockResolvedValue(2);
        mockPrismaService.task.groupBy.mockResolvedValue([
          { projectId: 'p-1', status: 'DONE', _count: { _all: 3 } },
          { projectId: 'p-1', status: 'IN_PROGRESS', _count: { _all: 1 } },
          { projectId: 'p-2', status: 'TODO', _count: { _all: 5 } },
        ]);

        const result = await service.findAll(1, 10);

        expect(mockPrismaService.task.groupBy).toHaveBeenCalledWith(
          expect.objectContaining({
            by: expect.arrayContaining(['projectId', 'status']),
            where: { projectId: { in: ['p-1', 'p-2'] } },
          }),
        );
        // p-1: 3 DONE / 4 total = 75%
        const p1 = result.data.find((p) => p.id === 'p-1');
        expect(p1?.progress).toBe(75);
        // p-2: 0 DONE / 5 total = 0%
        const p2 = result.data.find((p) => p.id === 'p-2');
        expect(p2?.progress).toBe(0);
      });

      it('progress is 0 when project has no tasks (groupBy returns no rows)', async () => {
        mockPrismaService.project.findMany.mockResolvedValue([{ ...mockProject, id: 'p-empty' }]);
        mockPrismaService.project.count.mockResolvedValue(1);
        mockPrismaService.task.groupBy.mockResolvedValue([]);

        const result = await service.findAll(1, 10);

        expect(result.data[0].progress).toBe(0);
      });
    });
  });

  // ============================================
  // FIND ONE
  // ============================================
  describe('findOne', () => {
    it('should return a project by id', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.findOne('project-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('project-1');
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return clients as flat [{id, name}] array', async () => {
      const clientId = '550e8400-e29b-41d4-a716-446655440001';
      const projectWithClients = {
        ...mockProject,
        clients: [{ client: { id: clientId, name: 'ACME Corp' } }],
      };
      mockPrismaService.project.findUnique.mockResolvedValue(
        projectWithClients,
      );

      const result = await service.findOne('project-1');

      expect(result.clients).toEqual([{ id: clientId, name: 'ACME Corp' }]);
    });

    it('should return empty clients array when project has no clients', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.findOne('project-1');

      expect(result.clients).toEqual([]);
    });
  });

  // ============================================
  // UPDATE
  // ============================================
  describe('update', () => {
    const updateDto = { name: 'Updated Project Name' };

    it('should update a project successfully', async () => {
      const updatedProject = { ...mockProject, name: 'Updated Project Name' };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.update.mockResolvedValue(updatedProject);

      const result = await service.update('project-1', updateDto);

      expect(result.name).toBe('Updated Project Name');
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when end date is before start date', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const invalidDto = {
        startDate: '2025-12-31',
        endDate: '2025-01-01',
      };

      await expect(service.update('project-1', invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow same-day project update (startDate === endDate)', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.update.mockResolvedValue({
        ...mockProject,
        startDate: new Date('2025-06-04'),
        endDate: new Date('2025-06-04'),
      });

      const sameDayDto = {
        startDate: '2025-06-04',
        endDate: '2025-06-04',
      };

      const result = await service.update('project-1', sameDayDto);
      expect(result).toBeDefined();
    });

    it('should update dates successfully', async () => {
      const dateDto = {
        startDate: '2025-02-01',
        endDate: '2025-11-30',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.update.mockResolvedValue({
        ...mockProject,
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-11-30'),
      });

      const result = await service.update('project-1', dateDto);

      expect(result).toBeDefined();
    });

    it('should update without dates', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.update.mockResolvedValue({
        ...mockProject,
        description: 'Updated',
      });

      const result = await service.update('project-1', {
        description: 'Updated',
      });

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when hiddenStatuses contains TODO', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        service.update('project-1', {
          hiddenStatuses: [TaskStatus.TODO] as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when hiddenStatuses contains DONE', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        service.update('project-1', {
          hiddenStatuses: [TaskStatus.DONE] as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update hiddenStatuses with valid statuses', async () => {
      const updatedProject = {
        ...mockProject,
        hiddenStatuses: [TaskStatus.IN_REVIEW, TaskStatus.BLOCKED],
      };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.update.mockResolvedValue(updatedProject);

      const result = await service.update('project-1', {
        hiddenStatuses: [TaskStatus.IN_REVIEW, TaskStatus.BLOCKED] as any,
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hiddenStatuses: [TaskStatus.IN_REVIEW, TaskStatus.BLOCKED],
          }) as object,
        }),
      );
    });

    // COR-016 — update() must reject all mutations on CANCELLED projects
    it('COR-016: should throw ConflictException when updating a CANCELLED project', async () => {
      const cancelledProject = { ...mockProject, status: ProjectStatus.CANCELLED };
      mockPrismaService.project.findUnique.mockResolvedValue(cancelledProject);

      await expect(
        service.update('project-1', { name: 'Try to revive' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.project.update).not.toHaveBeenCalled();
    });

    it('COR-016: should throw ConflictException when trying to revive a CANCELLED project via status change', async () => {
      const cancelledProject = { ...mockProject, status: ProjectStatus.CANCELLED };
      mockPrismaService.project.findUnique.mockResolvedValue(cancelledProject);

      await expect(
        service.update('project-1', { status: ProjectStatus.ACTIVE } as any),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.project.update).not.toHaveBeenCalled();
    });

    // COR-018 — update() clientIds sync must be wrapped in $transaction
    it('COR-018: project update + client sync (deleteMany+createMany) run inside $transaction when clientIds is provided', async () => {
      const updatedProject = { ...mockProject, name: 'Updated' };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.client.findMany.mockResolvedValue([{ id: 'client-1' }]);
      mockPrismaService.$transaction.mockImplementation(
        async (callback: (tx: typeof mockPrismaService) => Promise<unknown>) =>
          callback(mockPrismaService),
      );
      mockPrismaService.project.update.mockResolvedValue(updatedProject);
      mockPrismaService.projectClient.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.projectClient.createMany.mockResolvedValue({ count: 1 });

      await service.update('project-1', { clientIds: ['client-1'] } as any);

      // The project update AND the client sync must run inside a single $transaction.
      // Before the fix, $transaction is never called on the clientIds path → RED.
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  // ============================================
  // REMOVE (Soft delete)
  // ============================================
  describe('remove', () => {
    it('should update project status to CANCELLED', async () => {
      const cancelledProject = {
        ...mockProject,
        status: ProjectStatus.CANCELLED,
      };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.update.mockResolvedValue(cancelledProject);

      const result = await service.remove('project-1');

      expect(result.message).toBe('Projet annulé avec succès');
      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: { status: ProjectStatus.CANCELLED },
      });
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================
  // OWNERSHIP ENFORCEMENT (SEC-06 / BUG-04 / BUG-08)
  // ============================================
  describe('ownership enforcement on mutations', () => {
    const caller = { id: 'contrib-1', role: 'CONTRIBUTEUR' };

    describe('update', () => {
      it('throws ForbiddenException for non-owner without projects:manage_any', async () => {
        mockOwnershipService.isOwner.mockResolvedValue(false);
        mockPermissionsService.getPermissionsForRole.mockResolvedValue([
          'projects:update',
        ]);

        await expect(
          service.update('project-1', { name: 'x' }, caller),
        ).rejects.toThrow(ForbiddenException);

        expect(mockOwnershipService.isOwner).toHaveBeenCalledWith(
          'project',
          'project-1',
          'contrib-1',
        );
        // Mutation must not reach Prisma.
        expect(mockPrismaService.project.update).not.toHaveBeenCalled();
      });

      it('allows update when caller is project owner', async () => {
        mockOwnershipService.isOwner.mockResolvedValue(true);
        mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
        mockPrismaService.project.update.mockResolvedValue({
          ...mockProject,
          name: 'Updated',
        });

        const result = await service.update(
          'project-1',
          { name: 'Updated' },
          caller,
        );

        expect(result.name).toBe('Updated');
        expect(
          mockPermissionsService.getPermissionsForRole,
        ).not.toHaveBeenCalled();
      });

      it('allows update for non-owner holding projects:manage_any', async () => {
        mockOwnershipService.isOwner.mockResolvedValue(false);
        mockPermissionsService.getPermissionsForRole.mockResolvedValue([
          'projects:update',
          'projects:manage_any',
        ]);
        mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
        mockPrismaService.project.update.mockResolvedValue({
          ...mockProject,
          name: 'Admin Override',
        });

        const admin = { id: 'admin-1', role: 'ADMIN' };
        const result = await service.update(
          'project-1',
          { name: 'Admin Override' },
          admin,
        );

        expect(result.name).toBe('Admin Override');
      });
    });

    describe('remove', () => {
      it('throws ForbiddenException for non-owner without projects:manage_any', async () => {
        mockOwnershipService.isOwner.mockResolvedValue(false);
        mockPermissionsService.getPermissionsForRole.mockResolvedValue([
          'projects:delete',
        ]);

        await expect(service.remove('project-1', caller)).rejects.toThrow(
          ForbiddenException,
        );
        expect(mockPrismaService.project.update).not.toHaveBeenCalled();
      });

      it('allows remove when caller is project owner', async () => {
        mockOwnershipService.isOwner.mockResolvedValue(true);
        mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
        mockPrismaService.project.update.mockResolvedValue({
          ...mockProject,
          status: ProjectStatus.CANCELLED,
        });

        const result = await service.remove('project-1', caller);

        expect(result.message).toBe('Projet annulé avec succès');
      });

      it('allows remove for non-owner holding projects:manage_any', async () => {
        mockOwnershipService.isOwner.mockResolvedValue(false);
        mockPermissionsService.getPermissionsForRole.mockResolvedValue([
          'projects:manage_any',
        ]);
        mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
        mockPrismaService.project.update.mockResolvedValue({
          ...mockProject,
          status: ProjectStatus.CANCELLED,
        });

        const admin = { id: 'admin-1', role: 'ADMIN' };
        const result = await service.remove('project-1', admin);

        expect(result.message).toBe('Projet annulé avec succès');
      });
    });
  });

  // ============================================
  // HARD DELETE
  // ============================================
  describe('hardDelete', () => {
    const noDependents = () => {
      mockPrismaService.task.count.mockResolvedValue(0);
      mockPrismaService.projectSnapshot.count.mockResolvedValue(0);
      mockPrismaService.document.count.mockResolvedValue(0);
      mockPrismaService.timeEntry.count.mockResolvedValue(0);
    };

    it('should permanently delete a project with no blocking dependents', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      noDependents();
      mockPrismaService.project.delete.mockResolvedValue(mockProject);

      const result = await service.hardDelete('project-1', { id: 'user-1' });

      expect(result.message).toBe('Projet supprimé définitivement');
      expect(mockPrismaService.project.delete).toHaveBeenCalledWith({
        where: { id: 'project-1' },
      });
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.hardDelete('nonexistent', { id: 'user-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    // ── DAT-007 witnesses ───────────────────────────────────────────────
    // W-1: hard-delete on a Project with blocking dependents (Task /
    // ProjectSnapshot / Document / TimeEntry) must surface a typed
    // ConflictException — NOT a raw P2003 FK violation — and must NOT mutate
    // the Project. FAILS on master (no pre-check; delete proceeds & cascades).
    it('W-1: throws ConflictException and does not delete when tasks exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      noDependents();
      mockPrismaService.task.count.mockResolvedValue(3);

      await expect(
        service.hardDelete('project-1', { id: 'user-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mockPrismaService.project.delete).not.toHaveBeenCalled();
    });

    it('W-1: ConflictException enumerates every blocking dependency type with counts', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.task.count.mockResolvedValue(2);
      mockPrismaService.projectSnapshot.count.mockResolvedValue(5);
      mockPrismaService.document.count.mockResolvedValue(1);
      mockPrismaService.timeEntry.count.mockResolvedValue(7);

      let caught: ConflictException | undefined;
      try {
        await service.hardDelete('project-1', { id: 'user-1' });
      } catch (e) {
        caught = e as ConflictException;
      }
      expect(caught).toBeInstanceOf(ConflictException);
      const body = caught!.getResponse() as {
        dependencies: { type: string; count: number }[];
      };
      const byType = Object.fromEntries(
        body.dependencies.map((d) => [d.type, d.count]),
      );
      expect(byType).toMatchObject({
        TASKS: 2,
        SNAPSHOTS: 5,
        DOCUMENTS: 1,
        TIME_ENTRIES: 7,
      });
      expect(mockPrismaService.project.delete).not.toHaveBeenCalled();
    });

    it('W-1: does NOT delete when only snapshots/documents/timeEntries exist (no tasks)', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.task.count.mockResolvedValue(0);
      mockPrismaService.projectSnapshot.count.mockResolvedValue(4);
      mockPrismaService.document.count.mockResolvedValue(0);
      mockPrismaService.timeEntry.count.mockResolvedValue(0);

      await expect(
        service.hardDelete('project-1', { id: 'user-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mockPrismaService.project.delete).not.toHaveBeenCalled();
    });

    // W-3: a permitted hard-delete must persist a final PROJECT_DELETED audit
    // row carrying a column snapshot of the project before the row is erased,
    // so the lifecycle event survives in the immutable audit trail.
    // FAILS on master (hardDelete emits nothing to AuditPersistenceService).
    it('W-3: emits PROJECT_DELETED with a column snapshot before deleting', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      noDependents();
      mockPrismaService.project.delete.mockResolvedValue(mockProject);

      await service.hardDelete('project-1', { id: 'actor-9' });

      expect(mockAuditPersistenceService.log).toHaveBeenCalledTimes(1);
      const call = mockAuditPersistenceService.log.mock.calls[0][0];
      expect(call.action).toBe('PROJECT_DELETED');
      expect(call.entityType).toBe('Project');
      expect(call.entityId).toBe('project-1');
      expect(call.actorId).toBe('actor-9');
      expect(call.payload.snapshot).toMatchObject({
        id: 'project-1',
        name: 'Test Project',
        status: ProjectStatus.ACTIVE,
      });
      // snapshot is captured before the row is destroyed
      const logOrder =
        mockAuditPersistenceService.log.mock.invocationCallOrder[0];
      const deleteOrder =
        mockPrismaService.project.delete.mock.invocationCallOrder[0];
      expect(logOrder).toBeLessThan(deleteOrder);
    });
  });

  // ============================================
  // ADD MEMBER
  // ============================================
  describe('addMember', () => {
    const addMemberDto = {
      userId: 'user-1',
      role: 'Developer',
    };

    it('should add a member to project successfully', async () => {
      const mockMember = {
        id: 'member-1',
        projectId: 'project-1',
        userId: 'user-1',
        role: 'Developer',
        user: mockUser,
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.projectMember.findUnique.mockResolvedValue(null);
      mockPrismaService.projectMember.create.mockResolvedValue(mockMember);

      const result = await service.addMember('project-1', addMemberDto);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-1');
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('nonexistent', addMemberDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('project-1', addMemberDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when user is already a member', async () => {
      const existingMember = {
        id: 'member-1',
        projectId: 'project-1',
        userId: 'user-1',
      };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.projectMember.findUnique.mockResolvedValue(
        existingMember,
      );

      await expect(
        service.addMember('project-1', addMemberDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should add member with default role', async () => {
      const dtoWithoutRole = { userId: 'user-1' };
      const mockMember = {
        id: 'member-1',
        projectId: 'project-1',
        userId: 'user-1',
        role: 'Membre',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.projectMember.findUnique.mockResolvedValue(null);
      mockPrismaService.projectMember.create.mockResolvedValue(mockMember);

      const result = await service.addMember('project-1', dtoWithoutRole);

      expect(result).toBeDefined();
    });

    it('should add member with allocation and dates', async () => {
      const dtoWithDates = {
        userId: 'user-1',
        role: 'Developer',
        allocation: 80,
        startDate: '2025-01-01',
        endDate: '2025-06-30',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.projectMember.findUnique.mockResolvedValue(null);
      mockPrismaService.projectMember.create.mockResolvedValue({
        ...dtoWithDates,
        id: 'member-1',
        projectId: 'project-1',
      });

      const result = await service.addMember('project-1', dtoWithDates);

      expect(result).toBeDefined();
    });
  });

  // ============================================
  // REMOVE MEMBER
  // ============================================
  describe('removeMember', () => {
    it('should remove a member from project', async () => {
      const mockMember = {
        id: 'member-1',
        projectId: 'project-1',
        userId: 'user-1',
      };
      mockPrismaService.projectMember.findUnique.mockResolvedValue(mockMember);
      mockPrismaService.projectMember.delete.mockResolvedValue(mockMember);

      const result = await service.removeMember('project-1', 'user-1');

      expect(result.message).toBe('Membre retiré du projet avec succès');
      expect(mockPrismaService.projectMember.delete).toHaveBeenCalledWith({
        where: {
          projectId_userId: {
            projectId: 'project-1',
            userId: 'user-1',
          },
        },
      });
    });

    it('should throw NotFoundException when member not found', async () => {
      mockPrismaService.projectMember.findUnique.mockResolvedValue(null);

      await expect(
        service.removeMember('project-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // GET PROJECTS BY USER
  // ============================================
  describe('getProjectsByUser', () => {
    it('should return projects for a user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);

      const result = await service.getProjectsByUser('user-1');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            members: {
              some: { userId: 'user-1' },
            },
          },
        }),
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getProjectsByUser('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================
  // GET PROJECT STATS
  // ============================================
  describe('getProjectStats', () => {
    const projectWithData = {
      ...mockProject,
      tasks: [
        { id: 'task-1', status: 'DONE', estimatedHours: 10, priority: 'HIGH' },
        {
          id: 'task-2',
          status: 'IN_PROGRESS',
          estimatedHours: 8,
          priority: 'MEDIUM',
        },
        { id: 'task-3', status: 'TODO', estimatedHours: 5, priority: 'LOW' },
      ],
      members: [{ id: 'member-1' }, { id: 'member-2' }],
      epics: [{ progress: 100 }, { progress: 50 }],
      milestones: [
        { status: 'COMPLETED', dueDate: new Date('2025-01-15') },
        {
          status: 'IN_PROGRESS',
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        }, // 3 days from now
        { status: 'TODO', dueDate: new Date('2025-12-31') },
      ],
    };

    it('should return project statistics', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(projectWithData);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([
        { hours: 5 },
        { hours: 3 },
      ]);

      const result = await service.getProjectStats('project-1');

      expect(result.projectId).toBe('project-1');
      expect(result.tasks.total).toBe(3);
      expect(result.tasks.completed).toBe(1);
      expect(result.tasks.inProgress).toBe(1);
      expect(result.tasks.todo).toBe(1);
      expect(result.hours.estimated).toBe(23);
      expect(result.hours.actual).toBe(8);
      expect(result.team.totalMembers).toBe(2);
      expect(result.epics.total).toBe(2);
      expect(result.epics.completed).toBe(1);
      expect(result.milestones.total).toBe(3);
      expect(result.milestones.completed).toBe(1);
      expect(result.milestones.upcoming).toBe(1);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.getProjectStats('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle project with no tasks', async () => {
      const emptyProject = {
        ...mockProject,
        tasks: [],
        members: [],
        epics: [],
        milestones: [],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(emptyProject);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      const result = await service.getProjectStats('project-1');

      expect(result.progress).toBe(0);
      expect(result.tasks.total).toBe(0);
      expect(result.hours.estimated).toBe(0);
    });

    it('should handle project without budget hours', async () => {
      const projectNoBudget = {
        ...projectWithData,
        budgetHours: null,
      };

      mockPrismaService.project.findUnique.mockResolvedValue(projectNoBudget);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      const result = await service.getProjectStats('project-1');

      expect(result.budget).toBeNull();
    });

    it('should include budget info when budget hours exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(projectWithData);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([{ hours: 100 }]);

      const result = await service.getProjectStats('project-1');

      expect(result.budget).toBeDefined();
      expect(result.budget?.allocatedHours).toBe(1000);
      expect(result.budget?.actualHours).toBe(100);
      expect(result.budget?.remainingHours).toBe(900);
    });

    it('should calculate correct progress percentage', async () => {
      const projectHalfDone = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            status: 'DONE',
            estimatedHours: 10,
            priority: 'HIGH',
          },
          {
            id: 'task-2',
            status: 'DONE',
            estimatedHours: 10,
            priority: 'HIGH',
          },
          { id: 'task-3', status: 'TODO', estimatedHours: 10, priority: 'LOW' },
          { id: 'task-4', status: 'TODO', estimatedHours: 10, priority: 'LOW' },
        ],
        members: [],
        epics: [],
        milestones: [],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(projectHalfDone);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      const result = await service.getProjectStats('project-1');

      expect(result.progress).toBe(50);
    });

    it('should handle tasks with null estimated hours', async () => {
      const projectNullHours = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            status: 'TODO',
            estimatedHours: null,
            priority: 'HIGH',
          },
          { id: 'task-2', status: 'TODO', estimatedHours: 5, priority: 'LOW' },
        ],
        members: [],
        epics: [],
        milestones: [],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(projectNullHours);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      const result = await service.getProjectStats('project-1');

      expect(result.hours.estimated).toBe(5);
    });

    it('should return 0 remaining hours when actual exceeds estimated', async () => {
      const projectOverBudget = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            status: 'DONE',
            estimatedHours: 10,
            priority: 'HIGH',
          },
        ],
        members: [],
        epics: [],
        milestones: [],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(projectOverBudget);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([{ hours: 20 }]);

      const result = await service.getProjectStats('project-1');

      expect(result.hours.remaining).toBe(0);
    });

    it('should filter dismissed time entries from user and third-party findMany (D3)', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(projectWithData);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      await service.getProjectStats('project-1');

      const findManyCalls = mockPrismaService.timeEntry.findMany.mock.calls;
      // Two calls expected: user TE and third-party TE
      expect(findManyCalls.length).toBeGreaterThanOrEqual(2);
      for (const [args] of findManyCalls) {
        expect(args).toEqual(
          expect.objectContaining({
            where: expect.objectContaining({ isDismissal: false }),
          }),
        );
      }
    });
  });

  // ============================================
  // COMPUTED FLAGS: canArchive / canUnarchive
  // ============================================
  describe('computed canArchive / canUnarchive', () => {
    beforeEach(() => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:archive',
        'projects:read',
        'projects:update',
      ]);
    });

    it('returns canArchive=true and canUnarchive=false on an active project for a user with the permission', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        ...mockProject,
        archivedAt: null,
      });
      const result = await service.findOne('project-1', { id: 'user-1', role: 'MANAGER' });
      expect(result.canArchive).toBe(true);
      expect(result.canUnarchive).toBe(false);
    });

    it('returns canArchive=false and canUnarchive=true on an archived project', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        ...mockProject,
        archivedAt: new Date(),
      });
      const result = await service.findOne('project-1', { id: 'user-1', role: 'MANAGER' });
      expect(result.canArchive).toBe(false);
      expect(result.canUnarchive).toBe(true);
    });

    it('returns both flags false when user lacks projects:archive', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:read',
      ]);
      mockPrismaService.project.findUnique.mockResolvedValue({
        ...mockProject,
        archivedAt: null,
      });
      const result = await service.findOne('project-1', { id: 'user-1', role: 'OBSERVATEUR' });
      expect(result.canArchive).toBe(false);
      expect(result.canUnarchive).toBe(false);
    });

    it('returns both flags false when no currentUser is provided', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        ...mockProject,
        archivedAt: null,
      });
      const result = await service.findOne('project-1');
      expect(result.canArchive).toBe(false);
      expect(result.canUnarchive).toBe(false);
      // No permissions lookup when no user
      expect(mockPermissionsService.getPermissionsForRole).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // ARCHIVE / UNARCHIVE
  // ============================================
  describe('archive / unarchive', () => {
    const userCtx = { id: 'user-1', role: 'ADMIN' };

    beforeEach(() => {
      mockAuditPersistenceService.log.mockResolvedValue(undefined);
      mockOwnershipService.isOwner.mockResolvedValue(false);
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:manage_any',
      ]);
      mockPrismaService.project.findUnique.mockResolvedValue({
        ...mockProject,
        archivedAt: null,
      });
      mockPrismaService.project.update.mockImplementation(async ({ data }) => ({
        ...mockProject,
        ...data,
      }));
      // Wire $transaction so the callback executes with mockPrismaService as tx,
      // making both existing assertions and the new atomicity assertions work.
      mockPrismaService.$transaction.mockImplementation(
        async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrismaService),
      );
    });

    it('archives a project: sets archivedAt + archivedById and writes audit log', async () => {
      const result = await service.archive('project-1', userCtx);
      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: expect.objectContaining({
          archivedAt: expect.any(Date),
          archivedById: 'user-1',
        }),
      });
      expect(result.archivedAt).toBeDefined();
      expect(mockAuditPersistenceService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PROJECT_ARCHIVED',
          entityType: 'Project',
          entityId: 'project-1',
          actorId: 'user-1',
          payload: expect.objectContaining({ archivedAt: expect.any(Date) }),
        }),
        expect.anything(), // tx client (DAT-006: audit is inside the same $transaction)
      );
    });

    it('refuses to archive an already-archived project (409)', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        ...mockProject,
        archivedAt: new Date(),
      });
      await expect(service.archive('project-1', userCtx)).rejects.toThrow(
        /déjà archivé|already archived/i,
      );
    });

    it('unarchives a project: clears both fields', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        ...mockProject,
        archivedAt: new Date(),
        archivedById: 'user-1',
      });
      await service.unarchive('project-1', userCtx);
      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: { archivedAt: null, archivedById: null },
      });
      expect(mockAuditPersistenceService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PROJECT_UNARCHIVED',
          entityType: 'Project',
          entityId: 'project-1',
          actorId: 'user-1',
          payload: expect.objectContaining({ previousArchivedAt: expect.any(Date) }),
        }),
        expect.anything(), // tx client (DAT-006: audit is inside the same $transaction)
      );
    });

    it('refuses to unarchive a non-archived project (409)', async () => {
      await expect(service.unarchive('project-1', userCtx)).rejects.toThrow(
        /n'est pas archivé|not archived/i,
      );
    });

    it('refuses archive when project not found (404)', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);
      await expect(service.archive('missing', userCtx)).rejects.toThrow(
        /introuvable|not found/i,
      );
    });

    it('refuses unarchive when project not found (404)', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);
      await expect(service.unarchive('missing', userCtx)).rejects.toThrow(
        /introuvable|not found/i,
      );
    });

    // DAT-006 — atomicity: update + audit must run in the same $transaction
    it('archive: project.update and auditPersistence.log run inside the same $transaction (atomicity)', async () => {
      await service.archive('project-1', userCtx);

      // The outer $transaction must have been called (wraps both operations).
      expect(mockPrismaService.$transaction).toHaveBeenCalled();

      // log() must be called with the tx client (mockPrismaService) as 2nd arg,
      // proving update + audit share the same atomic scope.
      expect(mockAuditPersistenceService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PROJECT_ARCHIVED',
          entityType: 'Project',
          entityId: 'project-1',
          actorId: 'user-1',
        }),
        mockPrismaService,
      );
    });

    it('unarchive: project.update and auditPersistence.log run inside the same $transaction (atomicity)', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        ...mockProject,
        archivedAt: new Date(),
        archivedById: 'user-1',
      });
      await service.unarchive('project-1', userCtx);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();

      expect(mockAuditPersistenceService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PROJECT_UNARCHIVED',
          entityType: 'Project',
          entityId: 'project-1',
          actorId: 'user-1',
        }),
        mockPrismaService,
      );
    });
  });

  // ============================================
  // CAPTURE SNAPSHOTS (Wave 1.B)
  // ============================================
  describe('captureSnapshots', () => {
    const past = new Date('2025-01-01');
    const future = new Date('2099-12-31');

    const projectWithMixedData = {
      id: 'p-mixed',
      status: ProjectStatus.ACTIVE,
      tasks: [
        { status: TaskStatus.DONE },
        { status: TaskStatus.DONE },
        { status: TaskStatus.IN_PROGRESS },
        { status: TaskStatus.IN_PROGRESS },
        { status: TaskStatus.IN_PROGRESS },
        { status: TaskStatus.BLOCKED },
        { status: TaskStatus.TODO },
        { status: TaskStatus.IN_REVIEW },
      ],
      milestones: [
        { status: MilestoneStatus.COMPLETED, dueDate: past },
        { status: MilestoneStatus.COMPLETED, dueDate: future },
        { status: MilestoneStatus.PENDING, dueDate: past },
        { status: MilestoneStatus.IN_PROGRESS, dueDate: past },
        { status: MilestoneStatus.PENDING, dueDate: future },
      ],
    };

    const emptyProject = {
      id: 'p-empty',
      status: ProjectStatus.ACTIVE,
      tasks: [],
      milestones: [],
    };

    beforeEach(() => {
      // PER-003: batched path — findMany (existing today) + createMany (new only)
      mockPrismaService.projectSnapshot.findMany.mockResolvedValue([]);
      mockPrismaService.projectSnapshot.createMany.mockResolvedValue({ count: 0 });
      // legacy stubs — no longer called by captureSnapshots, kept to detect regressions
      mockPrismaService.projectSnapshot.upsert.mockImplementation(
        ({ create: data }) => Promise.resolve({ id: 'snap-id', ...data }),
      );
      mockPrismaService.projectSnapshot.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'snap-id', ...data }),
      );
      mockPrismaService.projectSnapshot.findFirst.mockResolvedValue(null);
    });

    it('only fetches ACTIVE projects with tasks + milestones in one query (no N+1)', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);

      await service.captureSnapshots();

      expect(mockPrismaService.project.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        include: {
          tasks: { select: { status: true } },
          milestones: { select: { status: true, dueDate: true } },
        },
      });
    });

    // PER-003: batched write — 2 total DB queries regardless of project count
    it('PER-003: uses one findMany + one createMany (2 total writes) instead of N upserts', async () => {
      const projects = [projectWithMixedData, emptyProject];
      mockPrismaService.project.findMany.mockResolvedValue(projects);
      // No existing snapshots today
      mockPrismaService.projectSnapshot.findMany.mockResolvedValue([]);
      mockPrismaService.projectSnapshot.createMany.mockResolvedValue({
        count: 2,
      });

      const result = await service.captureSnapshots();

      // Must NOT call upsert per-project (the old N+1 pattern)
      expect(mockPrismaService.projectSnapshot.upsert).not.toHaveBeenCalled();

      // Exactly one batched snapshot findMany (to check for existing today snapshots)
      expect(mockPrismaService.projectSnapshot.findMany).toHaveBeenCalledTimes(
        1,
      );

      // Exactly one createMany (not N individual writes)
      expect(mockPrismaService.projectSnapshot.createMany).toHaveBeenCalledTimes(1);
      const createManyCall =
        mockPrismaService.projectSnapshot.createMany.mock.calls[0][0];
      expect(createManyCall.skipDuplicates).toBe(true);
      expect(createManyCall.data).toHaveLength(2);

      expect(result).toEqual({ captured: 2 });
    });

    it('computes the 5 enriched counters correctly for a project with mixed data', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([
        projectWithMixedData,
      ]);
      mockPrismaService.projectSnapshot.createMany.mockResolvedValue({
        count: 1,
      });

      await service.captureSnapshots();

      // PER-003: payload lives in createMany data array (not upsert.create)
      const createManyCall =
        mockPrismaService.projectSnapshot.createMany.mock.calls[0][0];
      expect(createManyCall.data[0]).toMatchObject({
        projectId: 'p-mixed',
        progress: 25, // 2 done / 8 total = 25%
        tasksDone: 2,
        tasksTotal: 8,
        tasksInProgress: 3,
        tasksBlocked: 1,
        milestonesReached: 2, // both COMPLETED count regardless of dueDate
        milestonesOverdue: 2, // PENDING + IN_PROGRESS, both with past dueDate
        milestonesUpcoming: 1, // PENDING with future dueDate
      });
    });

    it('produces all-zero counters and progress=0 for a project with no tasks/milestones', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([emptyProject]);
      mockPrismaService.projectSnapshot.createMany.mockResolvedValue({
        count: 1,
      });

      await service.captureSnapshots();

      const createManyCall =
        mockPrismaService.projectSnapshot.createMany.mock.calls[0][0];
      expect(createManyCall.data[0]).toMatchObject({
        projectId: 'p-empty',
        progress: 0,
        tasksDone: 0,
        tasksTotal: 0,
        tasksInProgress: 0,
        tasksBlocked: 0,
        milestonesReached: 0,
        milestonesOverdue: 0,
        milestonesUpcoming: 0,
      });
    });

    it('returns the count of created snapshots', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([
        projectWithMixedData,
        emptyProject,
      ]);
      mockPrismaService.projectSnapshot.createMany.mockResolvedValue({
        count: 2,
      });

      const result = await service.captureSnapshots();

      // PER-003: single createMany covers all projects
      expect(result).toEqual({ captured: 2 });
      expect(mockPrismaService.projectSnapshot.createMany).toHaveBeenCalledTimes(1);
    });

    it('rounds progress to nearest integer', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([
        {
          id: 'p-round',
          status: ProjectStatus.ACTIVE,
          tasks: [
            { status: TaskStatus.DONE },
            { status: TaskStatus.DONE },
            { status: TaskStatus.TODO },
          ],
          milestones: [],
        },
      ]);
      mockPrismaService.projectSnapshot.createMany.mockResolvedValue({
        count: 1,
      });

      await service.captureSnapshots();

      const createManyCall =
        mockPrismaService.projectSnapshot.createMany.mock.calls[0][0];
      expect(createManyCall.data[0].progress).toBe(67); // 2/3 = 66.66 → rounded to 67
    });

    // PER-003 + COR-014: idempotency via skipDuplicates + @@unique([projectId,date])
    it('uses createMany(skipDuplicates) with date normalized to startOfDay for DB-level race safety (COR-014)', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([
        projectWithMixedData,
      ]);
      mockPrismaService.projectSnapshot.createMany.mockResolvedValue({
        count: 1,
      });

      await service.captureSnapshots();

      // Must NOT use upsert or per-row create
      expect(mockPrismaService.projectSnapshot.upsert).not.toHaveBeenCalled();
      expect(mockPrismaService.projectSnapshot.create).not.toHaveBeenCalled();

      const createManyCall =
        mockPrismaService.projectSnapshot.createMany.mock.calls[0][0];
      const expectedStartOfDay = new Date();
      expectedStartOfDay.setHours(0, 0, 0, 0);

      // skipDuplicates is the DB-level race guard (@@unique constraint handles concurrent ticks)
      expect(createManyCall.skipDuplicates).toBe(true);
      // date in payload must be normalized to midnight (start of day)
      expect(createManyCall.data[0].projectId).toBe('p-mixed');
      expect(createManyCall.data[0].date).toEqual(expectedStartOfDay);
    });

    it('should skip creation if snapshot already exists today for project (captured=0)', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([
        projectWithMixedData,
      ]);
      // Simulate: existing snapshot for today already in DB
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      mockPrismaService.projectSnapshot.findMany.mockResolvedValue([
        { projectId: 'p-mixed' },
      ]);

      const result = await service.captureSnapshots();

      // All projects already snapshotted → createMany not called, captured=0
      expect(mockPrismaService.projectSnapshot.createMany).not.toHaveBeenCalled();
      expect(result).toEqual({ captured: 0 });
    });

    it('creates snapshot for new day with date key normalized to startOfDay', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([
        projectWithMixedData,
      ]);
      // No existing snapshot today
      mockPrismaService.projectSnapshot.findMany.mockResolvedValue([]);
      mockPrismaService.projectSnapshot.createMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.captureSnapshots();

      const createManyCall =
        mockPrismaService.projectSnapshot.createMany.mock.calls[0][0];
      const expectedStartOfDay = new Date();
      expectedStartOfDay.setHours(0, 0, 0, 0);

      // The date stored must be normalized to midnight (start of day)
      expect(createManyCall.data[0].date).toEqual(expectedStartOfDay);
      expect(mockPrismaService.projectSnapshot.create).not.toHaveBeenCalled();
      expect(result).toEqual({ captured: 1 });
    });
  });
});
