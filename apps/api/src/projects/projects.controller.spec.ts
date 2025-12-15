import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let projectsService: ProjectsService;

  const mockProject = {
    id: 'project-id-1',
    name: 'Test Project',
    description: 'A test project',
    status: 'ACTIVE',
    priority: 'NORMAL',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    budgetHours: 1000,
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [],
    tasks: [],
    epics: [],
    milestones: [],
  };

  const mockProjectsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    hardDelete: vi.fn(),
    getProjectsByUser: vi.fn(),
    getProjectStats: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        {
          provide: ProjectsService,
          useValue: mockProjectsService,
        },
      ],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
    projectsService = module.get<ProjectsService>(ProjectsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createProjectDto = {
      name: 'New Project',
      description: 'A new project',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      budgetHours: 500,
    };

    it('should create a new project successfully', async () => {
      const expectedProject = { ...mockProject, ...createProjectDto, id: 'new-project-id' };
      mockProjectsService.create.mockResolvedValue(expectedProject);

      const result = await controller.create(createProjectDto);

      expect(result).toEqual(expectedProject);
      expect(mockProjectsService.create).toHaveBeenCalledWith(createProjectDto);
      expect(mockProjectsService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when end date is before start date', async () => {
      mockProjectsService.create.mockRejectedValue(
        new BadRequestException('La date de fin doit être postérieure à la date de début')
      );

      await expect(controller.create({
        ...createProjectDto,
        startDate: '2025-12-31',
        endDate: '2025-01-01',
      })).rejects.toThrow(BadRequestException);
    });

    it('should create project with minimal data', async () => {
      const minimalDto = { name: 'Minimal Project' };
      const expectedProject = { ...mockProject, name: 'Minimal Project' };
      mockProjectsService.create.mockResolvedValue(expectedProject);

      const result = await controller.create(minimalDto);

      expect(result.name).toBe('Minimal Project');
      expect(mockProjectsService.create).toHaveBeenCalledWith(minimalDto);
    });
  });

  describe('findAll', () => {
    it('should return paginated projects', async () => {
      const paginatedResult = {
        data: [mockProject],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockProjectsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockProjectsService.findAll).toHaveBeenCalledWith(1, 10, undefined);
    });

    it('should filter projects by status', async () => {
      const activeProjects = [mockProject];
      const paginatedResult = {
        data: activeProjects,
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockProjectsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10, 'ACTIVE' as any);

      expect(result.data[0].status).toBe('ACTIVE');
      expect(mockProjectsService.findAll).toHaveBeenCalledWith(1, 10, 'ACTIVE');
    });

    it('should handle empty results', async () => {
      const emptyResult = {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };

      mockProjectsService.findAll.mockResolvedValue(emptyResult);

      const result = await controller.findAll(1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a project by id', async () => {
      mockProjectsService.findOne.mockResolvedValue(mockProject);

      const result = await controller.findOne('project-id-1');

      expect(result).toEqual(mockProject);
      expect(mockProjectsService.findOne).toHaveBeenCalledWith('project-id-1');
    });

    it('should throw NotFoundException when project not found', async () => {
      mockProjectsService.findOne.mockRejectedValue(
        new NotFoundException('Projet introuvable')
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProjectsByUser', () => {
    it('should return projects for a specific user', async () => {
      const userProjects = [mockProject];
      mockProjectsService.getProjectsByUser.mockResolvedValue(userProjects);

      const result = await controller.getProjectsByUser('user-id-1');

      expect(result).toEqual(userProjects);
      expect(mockProjectsService.getProjectsByUser).toHaveBeenCalledWith('user-id-1');
    });

    it('should return empty array when user has no projects', async () => {
      mockProjectsService.getProjectsByUser.mockResolvedValue([]);

      const result = await controller.getProjectsByUser('user-without-projects');

      expect(result).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return project statistics', async () => {
      const projectStats = {
        totalTasks: 10,
        completedTasks: 5,
        inProgressTasks: 3,
        blockedTasks: 2,
        totalHoursEstimated: 100,
        totalHoursSpent: 45,
        progress: 50,
        membersCount: 5,
      };

      mockProjectsService.getProjectStats.mockResolvedValue(projectStats);

      const result = await controller.getStats('project-id-1');

      expect(result).toEqual(projectStats);
      expect(result.progress).toBe(50);
      expect(mockProjectsService.getProjectStats).toHaveBeenCalledWith('project-id-1');
    });

    it('should throw NotFoundException when project not found', async () => {
      mockProjectsService.getProjectStats.mockRejectedValue(
        new NotFoundException('Projet introuvable')
      );

      await expect(controller.getStats('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateProjectDto = {
      name: 'Updated Project Name',
      description: 'Updated description',
    };

    it('should update a project successfully', async () => {
      const updatedProject = { ...mockProject, ...updateProjectDto };
      mockProjectsService.update.mockResolvedValue(updatedProject);

      const result = await controller.update('project-id-1', updateProjectDto);

      expect(result).toEqual(updatedProject);
      expect(result.name).toBe('Updated Project Name');
      expect(mockProjectsService.update).toHaveBeenCalledWith('project-id-1', updateProjectDto);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockProjectsService.update.mockRejectedValue(
        new NotFoundException('Projet introuvable')
      );

      await expect(controller.update('nonexistent', updateProjectDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should update project status', async () => {
      const statusUpdate = { status: 'COMPLETED' };
      const completedProject = { ...mockProject, status: 'COMPLETED' };
      mockProjectsService.update.mockResolvedValue(completedProject);

      const result = await controller.update('project-id-1', statusUpdate);

      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('remove', () => {
    it('should soft delete a project (set status to CANCELLED)', async () => {
      const cancelledProject = { ...mockProject, status: 'CANCELLED' };
      mockProjectsService.remove.mockResolvedValue(cancelledProject);

      const result = await controller.remove('project-id-1');

      expect(result.status).toBe('CANCELLED');
      expect(mockProjectsService.remove).toHaveBeenCalledWith('project-id-1');
    });

    it('should throw NotFoundException when project not found', async () => {
      mockProjectsService.remove.mockRejectedValue(
        new NotFoundException('Projet introuvable')
      );

      await expect(controller.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete a project', async () => {
      mockProjectsService.hardDelete.mockResolvedValue({ message: 'Projet supprimé définitivement' });

      const result = await controller.hardDelete('project-id-1');

      expect(result.message).toBe('Projet supprimé définitivement');
      expect(mockProjectsService.hardDelete).toHaveBeenCalledWith('project-id-1');
    });

    it('should throw NotFoundException when project not found', async () => {
      mockProjectsService.hardDelete.mockRejectedValue(
        new NotFoundException('Projet introuvable')
      );

      await expect(controller.hardDelete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addMember', () => {
    const addMemberDto = {
      userId: 'user-id-1',
      role: 'Developer',
      allocation: 50,
    };

    it('should add a member to project successfully', async () => {
      const newMember = {
        id: 'member-id-1',
        projectId: 'project-id-1',
        userId: 'user-id-1',
        role: 'Developer',
        allocation: 50,
        user: { id: 'user-id-1', firstName: 'John', lastName: 'Doe' },
      };

      mockProjectsService.addMember.mockResolvedValue(newMember);

      const result = await controller.addMember('project-id-1', addMemberDto);

      expect(result).toEqual(newMember);
      expect(mockProjectsService.addMember).toHaveBeenCalledWith('project-id-1', addMemberDto);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockProjectsService.addMember.mockRejectedValue(
        new NotFoundException('Projet introuvable')
      );

      await expect(controller.addMember('nonexistent', addMemberDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockProjectsService.addMember.mockRejectedValue(
        new NotFoundException('Utilisateur introuvable')
      );

      await expect(controller.addMember('project-id-1', addMemberDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ConflictException when user is already a member', async () => {
      mockProjectsService.addMember.mockRejectedValue(
        new ConflictException("L'utilisateur est déjà membre du projet")
      );

      await expect(controller.addMember('project-id-1', addMemberDto)).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe('removeMember', () => {
    it('should remove a member from project', async () => {
      mockProjectsService.removeMember.mockResolvedValue({ message: 'Membre retiré du projet' });

      const result = await controller.removeMember('project-id-1', 'user-id-1');

      expect(result.message).toBe('Membre retiré du projet');
      expect(mockProjectsService.removeMember).toHaveBeenCalledWith('project-id-1', 'user-id-1');
    });

    it('should throw NotFoundException when member not found in project', async () => {
      mockProjectsService.removeMember.mockRejectedValue(
        new NotFoundException('Membre introuvable dans ce projet')
      );

      await expect(controller.removeMember('project-id-1', 'nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
