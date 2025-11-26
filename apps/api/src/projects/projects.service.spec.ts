import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    project: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    projectMember: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
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
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

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

    it('should create a project successfully', async () => {
      const mockProject = {
        id: '1',
        name: createProjectDto.name,
        description: createProjectDto.description,
        code: createProjectDto.code,
        startDate: new Date(createProjectDto.startDate),
        endDate: new Date(createProjectDto.endDate),
        status: 'DRAFT',
        managerId: createProjectDto.managerId,
        departmentId: createProjectDto.departmentId,
        members: [],
        epics: [],
        milestones: [],
        tasks: [],
      };

      mockPrismaService.project.create.mockResolvedValue(mockProject);

      const result = await service.create(createProjectDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createProjectDto.name);
      expect(result.code).toBe(createProjectDto.code);
    });

    it('should throw error when end date is before start date', async () => {
      const invalidDto = {
        ...createProjectDto,
        startDate: '2025-12-31',
        endDate: '2025-01-01',
      };

      await expect(service.create(invalidDto)).rejects.toThrow(
        'La date de fin doit être postérieure à la date de début'
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated projects', async () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Project 1',
          code: 'PROJ-001',
          status: 'ACTIVE',
        },
        {
          id: '2',
          name: 'Project 2',
          code: 'PROJ-002',
          status: 'ACTIVE',
        },
      ];

      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);
      mockPrismaService.project.count.mockResolvedValue(2);

      const result = await service.findAll(1, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toHaveLength(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('should filter projects by status', async () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Active Project',
          code: 'ACT-001',
          status: 'ACTIVE',
        },
      ];

      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);
      mockPrismaService.project.count.mockResolvedValue(1);

      await service.findAll(1, 10, 'ACTIVE' as any);

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' },
        })
      );
    });
  });

  describe('findOne', () => {
    it('should return a project by id', async () => {
      const mockProject = {
        id: '1',
        name: 'Test Project',
        code: 'TEST-001',
        status: 'ACTIVE',
        managerId: 'manager-1',
        departmentId: 'dept-1',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.findOne('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
      expect(result.name).toBe('Test Project');
    });

    it('should throw error when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow('Projet introuvable');
    });
  });

  describe('update', () => {
    const updateProjectDto = {
      name: 'Updated Project Name',
      description: 'Updated Description',
    };

    it('should update a project successfully', async () => {
      const existingProject = {
        id: '1',
        name: 'Old Name',
        code: 'TEST-001',
        status: 'ACTIVE',
      };

      const updatedProject = {
        ...existingProject,
        ...updateProjectDto,
      };

      mockPrismaService.project.findUnique.mockResolvedValue(existingProject);
      mockPrismaService.project.update.mockResolvedValue(updatedProject);

      const result = await service.update('1', updateProjectDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Project Name');
    });

    it('should throw error when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateProjectDto)).rejects.toThrow('Projet introuvable');
    });
  });

  describe('addMember', () => {
    it('should add a member to project successfully', async () => {
      const addMemberDto = {
        userId: 'user-1',
        role: 'Developer',
      };

      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
      };

      const mockUser = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
      };

      const mockMember = {
        id: 'member-1',
        projectId: 'project-1',
        userId: 'user-1',
        role: 'Developer',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.projectMember.findUnique.mockResolvedValue(null);
      mockPrismaService.projectMember.create.mockResolvedValue(mockMember);

      const result = await service.addMember('project-1', addMemberDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.projectMember.create).toHaveBeenCalled();
    });

    it('should throw error when project not found', async () => {
      const addMemberDto = {
        userId: 'user-1',
        role: 'Developer',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.addMember('nonexistent', addMemberDto)).rejects.toThrow('Projet introuvable');
    });
  });

  describe('remove', () => {
    it('should update project status to CANCELLED', async () => {
      const mockProject = {
        id: '1',
        name: 'Test Project',
        status: 'ACTIVE',
      };

      const canceledProject = {
        ...mockProject,
        status: 'CANCELLED',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.update.mockResolvedValue(canceledProject);

      await service.remove('1');

      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('should throw error when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow('Projet introuvable');
    });
  });
});
