import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { MilestonesService } from './milestones.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { MilestoneStatus } from 'database';

describe('MilestonesService', () => {
  let service: MilestonesService;

  const mockPrismaService = {
    milestone: {
      create: vi.fn(),
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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MilestonesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MilestonesService>(MilestonesService);
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
  });

  describe('importMilestones', () => {
    const projectId = 'project-1';
    const mockProject = { id: projectId, name: 'Test Project' };

    it('should create new milestones successfully', async () => {
      const milestones = [
        { name: 'Alpha Release', dueDate: '2026-06-30', description: 'Alpha' },
        { name: 'Beta Release', dueDate: '2026-09-30' },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findFirst.mockResolvedValue(null);
      mockPrismaService.milestone.create.mockResolvedValue({});

      const result = await service.importMilestones(projectId, milestones);

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.errorDetails).toHaveLength(0);
      expect(mockPrismaService.milestone.create).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.milestone.create).toHaveBeenCalledWith({
        data: {
          name: 'Alpha Release',
          description: 'Alpha',
          dueDate: new Date('2026-06-30'),
          status: MilestoneStatus.PENDING,
          projectId,
        },
      });
      expect(mockPrismaService.milestone.create).toHaveBeenCalledWith({
        data: {
          name: 'Beta Release',
          description: null,
          dueDate: new Date('2026-09-30'),
          status: MilestoneStatus.PENDING,
          projectId,
        },
      });
    });

    it('should skip duplicate milestones', async () => {
      const milestones = [
        { name: 'Existing Milestone', dueDate: '2026-06-30' },
        { name: 'New Milestone', dueDate: '2026-09-30' },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findFirst
        .mockResolvedValueOnce({ id: 'existing-1', name: 'Existing Milestone' })
        .mockResolvedValueOnce(null);
      mockPrismaService.milestone.create.mockResolvedValue({});

      const result = await service.importMilestones(projectId, milestones);

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(0);
      expect(result.errorDetails).toContain(
        'Ligne 2: Jalon "Existing Milestone" existe déjà',
      );
      expect(mockPrismaService.milestone.create).toHaveBeenCalledTimes(1);
    });

    it('should handle errors during creation', async () => {
      const milestones = [{ name: 'Failing Milestone', dueDate: '2026-06-30' }];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findFirst.mockResolvedValue(null);
      mockPrismaService.milestone.create.mockRejectedValue(
        new Error('Database constraint violation'),
      );

      const result = await service.importMilestones(projectId, milestones);

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(1);
      expect(result.errorDetails).toContain(
        'Ligne 2: Database constraint violation',
      );
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.importMilestones('nonexistent', [
          { name: 'Test', dueDate: '2026-06-30' },
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle mixed results with creates, skips, and errors', async () => {
      const milestones = [
        { name: 'New One', dueDate: '2026-06-30' },
        { name: 'Duplicate', dueDate: '2026-07-15' },
        { name: 'Error One', dueDate: '2026-08-20' },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.milestone.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'dup-1', name: 'Duplicate' })
        .mockResolvedValueOnce(null);
      mockPrismaService.milestone.create
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Unexpected error'));

      const result = await service.importMilestones(projectId, milestones);

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(1);
      expect(result.errorDetails).toHaveLength(2);
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
});
