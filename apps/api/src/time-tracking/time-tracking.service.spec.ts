import { Test, TestingModule } from '@nestjs/testing';
import { TimeTrackingService } from './time-tracking.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TimeTrackingService', () => {
  let service: TimeTrackingService;

  const mockPrismaService = {
    timeEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    task: {
      findUnique: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeTrackingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TimeTrackingService>(TimeTrackingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const userId = 'user-1';
    const createTimeEntryDto = {
      date: '2025-01-01',
      hours: 8,
      activityType: 'DEVELOPMENT' as const,
      taskId: 'task-1',
      projectId: 'project-1',
      description: 'Working on feature',
    };

    it('should create a time entry successfully', async () => {
      const mockUser = { id: 'user-1', firstName: 'John' };
      const mockTask = { id: 'task-1', title: 'Task', projectId: 'project-1' };
      const mockProject = { id: 'project-1', name: 'Project' };
      const mockEntry = {
        id: '1',
        userId,
        date: new Date(createTimeEntryDto.date),
        hours: createTimeEntryDto.hours,
        activityType: createTimeEntryDto.activityType,
        taskId: createTimeEntryDto.taskId,
        projectId: createTimeEntryDto.projectId,
        description: createTimeEntryDto.description,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.timeEntry.create.mockResolvedValue(mockEntry);

      const result = await service.create(userId, createTimeEntryDto);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
    });

    it('should throw error when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create(userId, createTimeEntryDto)).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    it('should return paginated time entries', async () => {
      const mockEntries = [
        {
          id: '1',
          userId: 'user-1',
          taskId: 'task-1',
          hours: 8,
          startTime: new Date(),
          endTime: new Date(),
        },
      ];

      mockPrismaService.timeEntry.findMany.mockResolvedValue(mockEntries);
      mockPrismaService.timeEntry.count.mockResolvedValue(1);

      const result = await service.findAll(1, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return a time entry by id', async () => {
      const mockEntry = {
        id: '1',
        userId: 'user-1',
        hours: 8,
      };

      mockPrismaService.timeEntry.findUnique.mockResolvedValue(mockEntry);

      const result = await service.findOne('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });

    it('should throw error when entry not found', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update a time entry successfully', async () => {
      const updateDto = { hours: 6 };
      const existingEntry = { id: '1', userId: 'user-1', hours: 8 };
      const updatedEntry = { ...existingEntry, ...updateDto };

      mockPrismaService.timeEntry.findUnique.mockResolvedValue(existingEntry);
      mockPrismaService.timeEntry.update.mockResolvedValue(updatedEntry);

      const result = await service.update('1', updateDto);

      expect(result).toBeDefined();
      expect(result.hours).toBe(6);
    });
  });

  describe('remove', () => {
    it('should delete a time entry', async () => {
      const mockEntry = { id: '1', userId: 'user-1' };

      mockPrismaService.timeEntry.findUnique.mockResolvedValue(mockEntry);
      mockPrismaService.timeEntry.delete.mockResolvedValue(mockEntry);

      await service.remove('1');

      expect(mockPrismaService.timeEntry.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
