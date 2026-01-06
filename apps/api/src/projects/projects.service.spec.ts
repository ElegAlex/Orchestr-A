import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ProjectStatus } from '../__mocks__/database';

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
    timeEntry: {
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
    _count: { members: 0, tasks: 0, epics: 0, milestones: 0 },
  };

  const mockUser = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.com',
    role: 'CONTRIBUTEUR',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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
    const setupTransactionMock = (projectToReturn: typeof mockProject | null) => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          project: {
            create: vi.fn().mockResolvedValue({ ...mockProject, id: 'new-project-id' }),
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
          where: { status: ProjectStatus.ACTIVE },
        }),
      );
    });

    it('should handle empty status filter', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(0);

      await service.findAll(1, 10);

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
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
  // HARD DELETE
  // ============================================
  describe('hardDelete', () => {
    it('should permanently delete a project', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.delete.mockResolvedValue(mockProject);

      const result = await service.hardDelete('project-1');

      expect(result.message).toBe('Projet supprimé définitivement');
      expect(mockPrismaService.project.delete).toHaveBeenCalledWith({
        where: { id: 'project-1' },
      });
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.hardDelete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
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
  });
});
