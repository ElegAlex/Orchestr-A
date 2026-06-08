import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { MilestonesService } from './milestones.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { MilestoneStatus, Prisma } from 'database';

describe('MilestonesService', () => {
  let service: MilestonesService;

  const mockPrismaService = {
    milestone: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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

  // OBS-026 — the CSV export emits a fire-and-forget DATA_EXPORTED audit row.
  const mockAuditPersistence = { log: vi.fn().mockResolvedValue(undefined) };

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
        MilestonesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
        {
          provide: AuditPersistenceService,
          useValue: mockAuditPersistence,
        },
      ],
    }).compile();

    service = module.get<MilestonesService>(MilestonesService);
    mockAuditPersistence.log.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createMilestoneDto = {
      name: 'MVP Release',
      description: 'First public release',
      projectId: 'project-1',
      dueDate: '2025-06-30',
    };

    it('should create a milestone successfully', async () => {
      const mockProject = { id: 'project-1', name: 'Test Project' };
      const mockMilestone = {
        id: '1',
        name: createMilestoneDto.name,
        description: createMilestoneDto.description,
        projectId: createMilestoneDto.projectId,
        dueDate: new Date(createMilestoneDto.dueDate),
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.create.mockResolvedValue(mockMilestone);

      const result = await service.create(createMilestoneDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createMilestoneDto.name);
    });

    it('should throw error when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(createMilestoneDto)).rejects.toThrow(
        'Projet introuvable',
      );
    });

    it('SEC-005 — non-member without projects:manage_any cannot create a milestone', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([]);
      mockPrismaService.projectMember.count.mockResolvedValue(0); // not a member

      await expect(
        service.create(createMilestoneDto, 'user-nonmember', 'CONTRIBUTEUR'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrismaService.milestone.create).not.toHaveBeenCalled();
    });

    it('SEC-005 — a project member can create a milestone', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([]);
      mockPrismaService.projectMember.count.mockResolvedValue(1); // is a member
      mockPrismaService.milestone.create.mockResolvedValue({ id: '1' });

      await service.create(createMilestoneDto, 'user-member', 'CONTRIBUTEUR');
      expect(mockPrismaService.projectMember.count).toHaveBeenCalledWith({
        where: { projectId: 'project-1', userId: 'user-member' },
      });
      expect(mockPrismaService.milestone.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated milestones', async () => {
      const mockMilestones = [
        {
          id: '1',
          name: 'Milestone 1',
          projectId: 'project-1',
          completed: false,
        },
        {
          id: '2',
          name: 'Milestone 2',
          projectId: 'project-1',
          completed: true,
        },
      ];

      mockPrismaService.milestone.findMany.mockResolvedValue(mockMilestones);
      mockPrismaService.milestone.count.mockResolvedValue(2);

      const result = await service.findAll(1, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toHaveLength(2);
    });

    it('SEC-006 — non-privileged caller only sees milestones from projects they are a member of', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([]);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.milestone.count.mockResolvedValue(0);

      await service.findAll(
        1,
        10,
        undefined,
        undefined,
        'user-1',
        'CONTRIBUTEUR',
      );

      const findManyCall =
        mockPrismaService.milestone.findMany.mock.calls[0][0];
      expect(findManyCall.where.project).toEqual({
        members: { some: { userId: 'user-1' } },
      });
    });

    it('SEC-006 — projects:manage_any sees all milestones without a membership filter', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:manage_any',
      ]);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.milestone.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, undefined, 'admin-user', 'ADMIN');

      const findManyCall =
        mockPrismaService.milestone.findMany.mock.calls[0][0];
      expect(findManyCall.where.project).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('should return a milestone by id', async () => {
      const mockMilestone = {
        id: '1',
        name: 'MVP Release',
        projectId: 'project-1',
        completed: false,
      };

      mockPrismaService.milestone.findUnique.mockResolvedValue(mockMilestone);

      const result = await service.findOne('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });

    it('should throw error when milestone not found', async () => {
      mockPrismaService.milestone.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Milestone introuvable',
      );
    });

    it('SEC-007 — findOne does not leak the full parent project row (slim id+name select)', async () => {
      mockPrismaService.milestone.findUnique.mockResolvedValue({
        id: '1',
        project: { id: 'p1', name: 'P' },
        tasks: [],
      });

      await service.findOne('1');

      const call = mockPrismaService.milestone.findUnique.mock.calls[0][0];
      expect(call.include.project).toEqual({
        select: { id: true, name: true },
      });
      expect(call.include.project).not.toBe(true);
    });
  });

  describe('update', () => {
    it('should update a milestone successfully', async () => {
      const updateDto = {
        name: 'Updated Milestone',
        completed: true,
      };

      const existingMilestone = {
        id: '1',
        name: 'Old Name',
        projectId: 'project-1',
        completed: false,
      };

      const updatedMilestone = {
        ...existingMilestone,
        ...updateDto,
      };

      mockPrismaService.milestone.findUnique.mockResolvedValue(
        existingMilestone,
      );
      mockPrismaService.milestone.update.mockResolvedValue(updatedMilestone);

      const result = await service.update('1', updateDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Milestone');
      expect(result.completed).toBe(true);
    });
  });

  describe('remove', () => {
    it('should delete a milestone', async () => {
      const mockMilestone = {
        id: '1',
        name: 'Milestone',
        tasks: [],
      };

      mockPrismaService.milestone.findUnique.mockResolvedValue(mockMilestone);
      mockPrismaService.milestone.delete.mockResolvedValue(mockMilestone);

      await service.remove('1');

      expect(mockPrismaService.milestone.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });

  describe('complete', () => {
    it('should mark a milestone as completed', async () => {
      const existingMilestone = {
        id: '1',
        name: 'MVP Release',
        projectId: 'project-1',
        status: 'PENDING',
        project: { id: 'project-1', name: 'Test Project' },
        tasks: [],
      };

      const completedMilestone = {
        ...existingMilestone,
        status: 'COMPLETED',
      };

      mockPrismaService.milestone.findUnique.mockResolvedValue(
        existingMilestone,
      );
      mockPrismaService.milestone.update.mockResolvedValue(completedMilestone);

      const result = await service.complete('1');

      expect(result).toBeDefined();
      expect(result.status).toBe('COMPLETED');
      expect(mockPrismaService.milestone.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { status: MilestoneStatus.COMPLETED },
      });
    });

    it('should throw NotFoundException when milestone does not exist', async () => {
      mockPrismaService.milestone.findUnique.mockResolvedValue(null);

      await expect(service.complete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('SEC-013 — complete() throws ForbiddenException for non-member without projects:manage_any', async () => {
      // The milestone belongs to project-1, but 'outsider-id' is not a member.
      // complete() must run assertProjectMembership just like update() and remove().
      const milestoneWithProject = {
        id: '1',
        name: 'Guarded Milestone',
        project: {
          id: 'project-1',
          members: [{ userId: 'member-id' }],
        },
        tasks: [],
      };

      mockPermissionsService.getPermissionsForRole.mockResolvedValue([]);
      mockPrismaService.milestone.findUnique.mockResolvedValue(
        milestoneWithProject,
      );

      await expect(
        service.complete('1', 'outsider-id', 'CONTRIBUTEUR'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SEC-013 — complete() allows a project member to complete', async () => {
      const milestoneWithProject = {
        id: '1',
        name: 'Guarded Milestone',
        status: 'PENDING',
        project: {
          id: 'project-1',
          members: [{ userId: 'member-id' }],
        },
        tasks: [],
      };

      mockPermissionsService.getPermissionsForRole.mockResolvedValue([]);
      mockPrismaService.milestone.findUnique.mockResolvedValue(
        milestoneWithProject,
      );
      mockPrismaService.milestone.update.mockResolvedValue({
        ...milestoneWithProject,
        status: 'COMPLETED',
      });

      const result = await service.complete('1', 'member-id', 'CONTRIBUTEUR');
      expect(result.status).toBe('COMPLETED');
    });

    it('SEC-013 — complete() bypasses membership check for projects:manage_any holder', async () => {
      const milestoneWithProject = {
        id: '1',
        name: 'Admin Milestone',
        status: 'PENDING',
        project: {
          id: 'project-1',
          members: [],
        },
        tasks: [],
      };

      // admin role resolves projects:manage_any — non-member should still succeed
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:manage_any',
      ]);
      mockPrismaService.milestone.findUnique.mockResolvedValue(
        milestoneWithProject,
      );
      mockPrismaService.milestone.update.mockResolvedValue({
        ...milestoneWithProject,
        status: 'COMPLETED',
      });

      const result = await service.complete('1', 'admin-id', 'ADMIN');
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('importMilestones', () => {
    const projectId = 'project-1';
    const mockProject = { id: projectId, name: 'Test Project' };

    it('SEC-009 — non-member without projects:manage_any cannot bulk-import milestones', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([]);
      mockPrismaService.projectMember.count.mockResolvedValue(0); // not a member

      await expect(
        service.importMilestones(
          projectId,
          [{ name: 'Alpha', dueDate: '2026-06-30' }],
          'user-nonmember',
          'CONTRIBUTEUR',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrismaService.milestone.createMany).not.toHaveBeenCalled();
    });

    it('should create new milestones successfully', async () => {
      const milestones = [
        { name: 'Alpha Release', dueDate: '2026-06-30', description: 'Alpha' },
        { name: 'Beta Release', dueDate: '2026-09-30' },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      // Pre-fetch pattern: findMany returns no existing names
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.milestone.createMany.mockResolvedValue({ count: 2 });

      const result = await service.importMilestones(projectId, milestones);

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.errorDetails).toHaveLength(0);
      expect(mockPrismaService.milestone.createMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.milestone.createMany).toHaveBeenCalledWith({
        data: [
          {
            name: 'Alpha Release',
            description: 'Alpha',
            dueDate: new Date('2026-06-30'),
            status: MilestoneStatus.PENDING,
            projectId,
          },
          {
            name: 'Beta Release',
            description: null,
            dueDate: new Date('2026-09-30'),
            status: MilestoneStatus.PENDING,
            projectId,
          },
        ],
      });
    });

    it('should skip duplicate milestones', async () => {
      const milestones = [
        { name: 'Existing Milestone', dueDate: '2026-06-30' },
        { name: 'New Milestone', dueDate: '2026-09-30' },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      // Pre-fetch returns the existing name
      mockPrismaService.milestone.findMany.mockResolvedValue([
        { name: 'Existing Milestone' },
      ]);
      mockPrismaService.milestone.createMany.mockResolvedValue({ count: 1 });

      const result = await service.importMilestones(projectId, milestones);

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(0);
      expect(result.errorDetails).toContain(
        'Ligne 2: Jalon "Existing Milestone" existe déjà',
      );
      expect(mockPrismaService.milestone.createMany).toHaveBeenCalledTimes(1);
    });

    it('should handle errors during creation', async () => {
      const milestones = [{ name: 'Failing Milestone', dueDate: '2026-06-30' }];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.milestone.createMany.mockRejectedValue(
        new Error('Database constraint violation'),
      );

      const result = await service.importMilestones(projectId, milestones);

      expect(result.errors).toBeGreaterThan(0);
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.importMilestones('nonexistent', [
          { name: 'Test', dueDate: '2026-06-30' },
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle mixed results with creates and skips', async () => {
      const milestones = [
        { name: 'New One', dueDate: '2026-06-30' },
        { name: 'Duplicate', dueDate: '2026-07-15' },
        { name: 'Another New', dueDate: '2026-08-20' },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([
        { name: 'Duplicate' },
      ]);
      mockPrismaService.milestone.createMany.mockResolvedValue({ count: 2 });

      const result = await service.importMilestones(projectId, milestones);

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(0);
      expect(result.errorDetails).toHaveLength(1);
    });

    it('PER-010 — importMilestones never calls findFirst (pre-fetch replaces per-row lookup)', async () => {
      const milestones = Array.from({ length: 10 }, (_, i) => ({
        name: `Milestone ${i + 1}`,
        dueDate: '2026-12-31',
      }));

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);
      mockPrismaService.milestone.createMany.mockResolvedValue({ count: 10 });

      await service.importMilestones(projectId, milestones);

      // findFirst must NOT be called — all lookups replaced by the Set
      expect(mockPrismaService.milestone.findFirst).not.toHaveBeenCalled();
      // createMany is called exactly once (batch insert)
      expect(mockPrismaService.milestone.createMany).toHaveBeenCalledTimes(1);
      // findMany is called once (pre-fetch existing names)
      expect(mockPrismaService.milestone.findMany).toHaveBeenCalledTimes(1);
    });

    it('COR-018 — second import of same name counts as skipped, not an error', async () => {
      // Simulates the TOCTOU scenario: the first import created "Shared Milestone".
      // A second import containing the same name should count it as skipped (not error).
      const milestones = [
        { name: 'Shared Milestone', dueDate: '2026-06-30' },
        { name: 'Unique Milestone', dueDate: '2026-07-31' },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      // Pre-fetch already sees "Shared Milestone" in the DB (simulates prior import)
      mockPrismaService.milestone.findMany.mockResolvedValue([
        { name: 'Shared Milestone' },
      ]);
      mockPrismaService.milestone.createMany.mockResolvedValue({ count: 1 });

      const result = await service.importMilestones(projectId, milestones);

      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(0);
      expect(result.created).toBe(1);
      // The duplicate name must appear in errorDetails (as a skip notice), not as an uncaught error
      expect(result.errorDetails).toContain(
        'Ligne 2: Jalon "Shared Milestone" existe déjà',
      );
    });
  });

  describe('validateImport', () => {
    const projectId = 'project-1';
    const mockProject = { id: projectId, name: 'Test Project' };

    it('should mark valid items as ready to import', async () => {
      const milestones = [
        { name: 'Alpha Release', dueDate: '2099-12-31', description: 'Alpha' },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);

      const result = await service.validateImport(projectId, milestones);

      expect(result.valid).toHaveLength(1);
      expect(result.duplicates).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.summary.total).toBe(1);
      expect(result.summary.valid).toBe(1);

      const validItem = result.valid[0];
      expect(validItem.lineNumber).toBe(2);
      expect(validItem.status).toBe('valid');
      expect(validItem.messages).toContain('Prêt à être importé');
      expect(validItem.milestone).toEqual(milestones[0]);
    });

    it('should detect duplicates from existing milestones', async () => {
      const milestones = [
        { name: 'Existing Milestone', dueDate: '2099-12-31' },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([
        { name: 'Existing Milestone' },
      ]);

      const result = await service.validateImport(projectId, milestones);

      expect(result.duplicates).toHaveLength(1);
      expect(result.valid).toHaveLength(0);
      expect(result.summary.duplicates).toBe(1);

      const dupItem = result.duplicates[0];
      expect(dupItem.status).toBe('duplicate');
      expect(dupItem.messages).toContain('Un jalon avec ce nom existe déjà');
    });

    it('should detect duplicates case-insensitively', async () => {
      const milestones = [
        { name: 'EXISTING milestone', dueDate: '2099-12-31' },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([
        { name: 'existing Milestone' },
      ]);

      const result = await service.validateImport(projectId, milestones);

      expect(result.duplicates).toHaveLength(1);
      expect(result.summary.duplicates).toBe(1);
    });

    it('should detect duplicates within the same import batch', async () => {
      const milestones = [
        { name: 'New Milestone', dueDate: '2099-12-31' },
        { name: 'New Milestone', dueDate: '2099-11-30' },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);

      const result = await service.validateImport(projectId, milestones);

      expect(result.valid).toHaveLength(1);
      expect(result.duplicates).toHaveLength(1);
      expect(result.summary.valid).toBe(1);
      expect(result.summary.duplicates).toBe(1);
    });

    it('should report error when name is missing', async () => {
      const milestones = [{ name: '', dueDate: '2099-12-31' }];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);

      const result = await service.validateImport(projectId, milestones);

      expect(result.errors).toHaveLength(1);
      expect(result.valid).toHaveLength(0);
      expect(result.summary.errors).toBe(1);

      const errorItem = result.errors[0];
      expect(errorItem.status).toBe('error');
      expect(errorItem.messages).toContain('Le nom est obligatoire');
    });

    it('should report error when dueDate is missing', async () => {
      const milestones = [{ name: 'Valid Name', dueDate: '' }];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);

      const result = await service.validateImport(projectId, milestones);

      expect(result.errors).toHaveLength(1);
      expect(result.summary.errors).toBe(1);

      const errorItem = result.errors[0];
      expect(errorItem.status).toBe('error');
      expect(errorItem.messages).toContain(
        "La date d'échéance est obligatoire",
      );
    });

    it('should report error for invalid date format', async () => {
      const milestones = [{ name: 'Milestone', dueDate: 'not-a-date' }];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);

      const result = await service.validateImport(projectId, milestones);

      expect(result.errors).toHaveLength(1);
      expect(result.summary.errors).toBe(1);

      const errorItem = result.errors[0];
      expect(errorItem.status).toBe('error');
      expect(errorItem.messages).toContain(
        "Date d'échéance invalide: not-a-date",
      );
    });

    it('should add warning when due date is in the past', async () => {
      const milestones = [{ name: 'Past Milestone', dueDate: '2020-01-01' }];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);

      const result = await service.validateImport(projectId, milestones);

      expect(result.warnings).toHaveLength(1);
      expect(result.valid).toHaveLength(0);
      expect(result.summary.warnings).toBe(1);

      const warningItem = result.warnings[0];
      expect(warningItem.status).toBe('warning');
      expect(warningItem.messages).toContain(
        "La date d'échéance est dans le passé",
      );
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.validateImport('nonexistent', [
          { name: 'Test', dueDate: '2099-12-31' },
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle a mix of valid, duplicate, error, and warning items', async () => {
      const milestones = [
        { name: 'Valid Future', dueDate: '2099-12-31' },
        { name: 'Existing One', dueDate: '2099-06-15' },
        { name: '', dueDate: '2099-03-01' },
        { name: 'Past Date', dueDate: '2020-06-15' },
        { name: 'Bad Date', dueDate: 'xyz' },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([
        { name: 'Existing One' },
      ]);

      const result = await service.validateImport(projectId, milestones);

      expect(result.summary.total).toBe(5);
      expect(result.summary.valid).toBe(1);
      expect(result.summary.duplicates).toBe(1);
      expect(result.summary.errors).toBe(2);
      expect(result.summary.warnings).toBe(1);
      expect(result.valid).toHaveLength(1);
      expect(result.duplicates).toHaveLength(1);
      expect(result.errors).toHaveLength(2);
      expect(result.warnings).toHaveLength(1);
    });

    it('should assign correct line numbers starting from 2', async () => {
      const milestones = [
        { name: 'First', dueDate: '2099-01-01' },
        { name: 'Second', dueDate: '2099-02-01' },
        { name: 'Third', dueDate: '2099-03-01' },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findMany.mockResolvedValue([]);

      const result = await service.validateImport(projectId, milestones);

      expect(result.valid[0].lineNumber).toBe(2);
      expect(result.valid[1].lineNumber).toBe(3);
      expect(result.valid[2].lineNumber).toBe(4);
    });
  });

  describe('getImportTemplate', () => {
    it('should return a CSV template string with headers and comments', () => {
      const template = service.getImportTemplate();

      expect(template).toBeDefined();
      expect(typeof template).toBe('string');

      const lines = template.split('\n');
      expect(lines).toHaveLength(2);

      // First line: semicolon-separated headers
      expect(lines[0]).toBe('name;description;dueDate');

      // Second line: semicolon-separated comment explanations
      expect(lines[1]).toBe(
        '# Nom du jalon;# Description optionnelle;# YYYY-MM-DD',
      );
    });

    it('should use semicolon as delimiter', () => {
      const template = service.getImportTemplate();
      const headerLine = template.split('\n')[0];

      const columns = headerLine.split(';');
      expect(columns).toHaveLength(3);
      expect(columns).toEqual(['name', 'description', 'dueDate']);
    });
  });

  // OBS-026 — the project CSV export egresses milestone rows; it must leave a
  // DATA_EXPORTED RGPD trail naming who exported which project.
  describe('exportProjectMilestonesCsv', () => {
    const project = { id: 'project-1', name: 'Test Project' };
    const milestones = [
      { name: 'M1', description: '', dueDate: new Date('2025-01-01') },
      { name: 'M2', description: 'desc', dueDate: new Date('2025-02-01') },
    ];

    beforeEach(() => {
      mockPrismaService.project.findUnique.mockResolvedValue(project);
      mockPrismaService.milestone.findMany.mockResolvedValue(milestones);
    });

    it('emits DATA_EXPORTED with scope/format/recordCount/subject/ip/ua (OBS-026)', async () => {
      await service.exportProjectMilestonesCsv(
        'project-1',
        { id: 'user-1' },
        { ip: '10.0.0.7', ua: 'vitest' },
      );

      expect(mockAuditPersistence.log).toHaveBeenCalledTimes(1);
      const call = mockAuditPersistence.log.mock.calls[0][0];
      expect(call.action).toBe('DATA_EXPORTED');
      expect(call.entityType).toBe('Export');
      expect(call.actorId).toBe('user-1');
      expect(call.entityId).toBe('user-1');
      expect(call.payload.format).toBe('csv');
      expect(call.payload.scope).toBe('milestones');
      // 2 milestone rows materialized — exact, not estimated.
      expect(call.payload.recordCount).toBe(2);
      expect(call.payload.subject).toEqual({ projectId: 'project-1' });
      expect(call.payload.ip).toBe('10.0.0.7');
      expect(call.payload.ua).toBe('vitest');
    });

    it('does NOT emit when caller is undefined (caller-as-actor invariant)', async () => {
      await service.exportProjectMilestonesCsv('project-1');

      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });

    it('still returns the CSV even when the audit log rejects (fire-and-forget)', async () => {
      mockAuditPersistence.log.mockRejectedValueOnce(new Error('audit down'));

      const result = await service.exportProjectMilestonesCsv('project-1', {
        id: 'user-1',
      });

      expect(result.csv).toContain('name;description;dueDate');
    });

    it('SEC-011 — neutralises CSV formula injection in milestone name/description (CWE-1236)', async () => {
      mockPrismaService.milestone.findMany.mockResolvedValue([
        { name: '=1+1', description: '-2+3', dueDate: new Date('2025-01-01') },
      ]);

      const result = await service.exportProjectMilestonesCsv('project-1');

      expect(result.csv).toContain("'=1+1");
      expect(result.csv).toContain("'-2+3");
      expect(result.csv).not.toMatch(/(^|;)=1\+1/m);
    });
  });

  // COR-002 — the membership bypass in assertProjectMembership must rest on the
  // resolved `projects:manage_any` permission, never on the literal role code
  // 'ADMIN' (sibling of COR-001 on EpicsService). Unlike epics' spec, the
  // milestones `update`/`remove` tests above never pass a currentUserId, so they
  // do NOT reach assertProjectMembership — the member-passes regression below is
  // added here because (unlike epics) no existing test covers the gate.
  describe('assertProjectMembership permission bypass (COR-002)', () => {
    const mockMilestoneWithProject = {
      id: '1',
      name: 'Milestone',
      tasks: [],
      project: {
        id: 'project-1',
        members: [{ userId: 'user-1' }],
      },
    };

    it('should bypass membership for a non-ADMIN role whose resolved permissions include projects:manage_any', async () => {
      // Institutional role bound to the ADMIN template: its code is NOT the
      // literal 'ADMIN', but its resolved permissions include the bypass.
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:manage_any',
      ]);
      mockPrismaService.milestone.findUnique.mockResolvedValue(
        mockMilestoneWithProject,
      );
      mockPrismaService.milestone.update.mockResolvedValue({
        ...mockMilestoneWithProject,
        name: 'Institutional Admin Updated',
      });

      // 'direction-si' is NOT in project.members — the ONLY thing letting the
      // update through is the manage_any bypass. Pre-fix (role-code check) this
      // falls through to the membership check and throws ForbiddenException.
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
      mockPrismaService.milestone.findUnique.mockResolvedValue(
        mockMilestoneWithProject,
      );

      await expect(
        service.update(
          '1',
          { name: 'Forbidden' },
          'non-member',
          'DIRECTION_SI',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow a project member without projects:manage_any to update', async () => {
      // Regression guard the epics spec got for free (its update test passed a
      // userId); milestones' did not, so it is added explicitly here. Passes
      // both pre- and post-fix — the member falls through the bypass to the
      // membership check and is found in project.members.
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([]);
      mockPrismaService.milestone.findUnique.mockResolvedValue(
        mockMilestoneWithProject,
      );
      mockPrismaService.milestone.update.mockResolvedValue({
        ...mockMilestoneWithProject,
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
  });

  // COR-056 — update/remove must catch Prisma P2025 and surface NotFoundException
  // instead of letting an unhandled error bubble as a 500.
  describe('COR-056 — update/remove catch P2025 (concurrent delete) → NotFoundException', () => {
    const p2025 = new Prisma.PrismaClientKnownRequestError(
      'An operation failed because it depends on one or more records that were required but not found.',
      { code: 'P2025', clientVersion: 'test' },
    );

    it('COR-056 — update() throws NotFoundException when milestone.update raises P2025', async () => {
      // findOne passes (milestone exists at read time), but update hits P2025
      mockPrismaService.milestone.findUnique.mockResolvedValue({
        id: '1',
        name: 'Milestone',
        tasks: [],
        project: { id: 'project-1', name: 'Project' },
      });
      mockPrismaService.milestone.update.mockRejectedValueOnce(p2025);

      await expect(service.update('1', { name: 'Updated' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('COR-056 — remove() throws NotFoundException when milestone.delete raises P2025', async () => {
      mockPrismaService.milestone.findUnique.mockResolvedValue({
        id: '1',
        name: 'Milestone',
        tasks: [],
        project: { id: 'project-1', name: 'Project' },
      });
      mockPrismaService.milestone.delete.mockRejectedValueOnce(p2025);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });
  });
});
