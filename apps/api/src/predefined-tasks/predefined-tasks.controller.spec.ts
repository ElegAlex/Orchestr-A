import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PredefinedTasksController } from './predefined-tasks.controller';
import { PredefinedTasksService } from './predefined-tasks.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('PredefinedTasksController', () => {
  let controller: PredefinedTasksController;

  const mockTask = {
    id: 'task-1',
    name: 'Permanence accueil',
    description: 'Accueil du public',
    color: '#3B82F6',
    icon: '🏢',
    defaultDuration: 'FULL_DAY',
    isActive: true,
    createdById: 'user-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    createdBy: { id: 'user-1', firstName: 'Jean', lastName: 'Dupont' },
  };

  const mockAssignment = {
    id: 'assignment-1',
    predefinedTaskId: 'task-1',
    userId: 'user-1',
    date: new Date('2026-03-25'),
    period: 'FULL_DAY',
    assignedById: 'admin-1',
    isRecurring: false,
    recurringRuleId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    predefinedTask: {
      id: 'task-1',
      name: 'Permanence accueil',
      color: '#3B82F6',
      icon: '🏢',
    },
    user: { id: 'user-1', firstName: 'Jean', lastName: 'Dupont' },
    assignedBy: { id: 'admin-1', firstName: 'Admin', lastName: 'System' },
  };

  const mockRecurringRule = {
    id: 'rule-1',
    predefinedTaskId: 'task-1',
    userId: 'user-1',
    dayOfWeek: 0,
    period: 'FULL_DAY',
    startDate: new Date('2026-01-06'),
    endDate: null,
    isActive: true,
    createdById: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    predefinedTask: {
      id: 'task-1',
      name: 'Permanence accueil',
      color: '#3B82F6',
      icon: '🏢',
    },
    user: { id: 'user-1', firstName: 'Jean', lastName: 'Dupont' },
    createdBy: { id: 'admin-1', firstName: 'Admin', lastName: 'System' },
  };

  const mockPredefinedTasksService = {
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    findAssignments: vi.fn(),
    createAssignment: vi.fn(),
    createBulkAssignment: vi.fn(),
    removeAssignment: vi.fn(),
    findRecurringRules: vi.fn(),
    createRecurringRule: vi.fn(),
    updateRecurringRule: vi.fn(),
    removeRecurringRule: vi.fn(),
    generateFromRules: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PredefinedTasksController],
      providers: [
        {
          provide: PredefinedTasksService,
          useValue: mockPredefinedTasksService,
        },
      ],
    }).compile();

    controller = module.get<PredefinedTasksController>(
      PredefinedTasksController,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================
  // CRUD Tâches Prédéfinies
  // ===========================

  describe('findAll', () => {
    it('devrait retourner la liste des tâches prédéfinies', async () => {
      mockPredefinedTasksService.findAll.mockResolvedValue([mockTask]);

      const result = await controller.findAll();

      expect(mockPredefinedTasksService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual([mockTask]);
    });
  });

  describe('create', () => {
    it('devrait créer une tâche prédéfinie', async () => {
      mockPredefinedTasksService.create.mockResolvedValue(mockTask);

      const dto = {
        name: 'Permanence accueil',
        description: 'Accueil du public',
        color: '#3B82F6',
        icon: '🏢',
        defaultDuration: 'FULL_DAY',
      };

      const result = await controller.create('user-1', dto);

      expect(mockPredefinedTasksService.create).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(mockTask);
    });
  });

  describe('update', () => {
    it('devrait appeler le service avec les bons paramètres', async () => {
      const updatedTask = { ...mockTask, name: 'Nouveau nom' };
      mockPredefinedTasksService.update.mockResolvedValue(updatedTask);

      const result = await controller.update('task-1', { name: 'Nouveau nom' });

      expect(mockPredefinedTasksService.update).toHaveBeenCalledWith('task-1', {
        name: 'Nouveau nom',
      });
      expect(result.name).toBe('Nouveau nom');
    });

    it('devrait propager la NotFoundException du service', async () => {
      mockPredefinedTasksService.update.mockRejectedValue(
        new NotFoundException('Tâche prédéfinie task-1 introuvable'),
      );

      await expect(
        controller.update('task-1', { name: 'Nouveau nom' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('devrait effectuer le soft delete', async () => {
      mockPredefinedTasksService.remove.mockResolvedValue({
        ...mockTask,
        isActive: false,
      });

      await controller.remove('task-1');

      expect(mockPredefinedTasksService.remove).toHaveBeenCalledWith('task-1');
    });
  });

  // ===========================
  // Assignations
  // ===========================

  describe('findAssignments', () => {
    it('devrait retourner les assignations avec filtres', async () => {
      mockPredefinedTasksService.findAssignments.mockResolvedValue([
        mockAssignment,
      ]);

      const result = await controller.findAssignments(
        'user-1',
        '2026-03-01',
        '2026-03-31',
        'task-1',
      );

      expect(mockPredefinedTasksService.findAssignments).toHaveBeenCalledWith({
        userId: 'user-1',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        predefinedTaskId: 'task-1',
      });
      expect(result).toEqual([mockAssignment]);
    });

    it('devrait fonctionner sans filtres', async () => {
      mockPredefinedTasksService.findAssignments.mockResolvedValue([
        mockAssignment,
      ]);

      await controller.findAssignments();

      expect(mockPredefinedTasksService.findAssignments).toHaveBeenCalledWith({
        userId: undefined,
        startDate: undefined,
        endDate: undefined,
        predefinedTaskId: undefined,
      });
    });
  });

  describe('createAssignment', () => {
    it('devrait créer une assignation', async () => {
      mockPredefinedTasksService.createAssignment.mockResolvedValue(
        mockAssignment,
      );

      const dto = {
        predefinedTaskId: 'task-1',
        userId: 'user-1',
        date: '2026-03-25T00:00:00Z',
        period: 'FULL_DAY',
      };

      const result = await controller.createAssignment('admin-1', dto);

      expect(mockPredefinedTasksService.createAssignment).toHaveBeenCalledWith(
        'admin-1',
        dto,
      );
      expect(result).toEqual(mockAssignment);
    });

    it('devrait propager ConflictException en cas de doublon', async () => {
      mockPredefinedTasksService.createAssignment.mockRejectedValue(
        new ConflictException('Assignation déjà existante'),
      );

      const dto = {
        predefinedTaskId: 'task-1',
        userId: 'user-1',
        date: '2026-03-25T00:00:00Z',
        period: 'FULL_DAY',
      };

      await expect(controller.createAssignment('admin-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('createBulkAssignment', () => {
    it('devrait créer des assignations en masse', async () => {
      const bulkResult = { created: 4, skipped: 0, errors: [] };
      mockPredefinedTasksService.createBulkAssignment.mockResolvedValue(
        bulkResult,
      );

      const dto = {
        predefinedTaskId: 'task-1',
        userIds: ['user-1', 'user-2'],
        dates: ['2026-03-25T00:00:00Z', '2026-03-26T00:00:00Z'],
        period: 'FULL_DAY',
      };

      const result = await controller.createBulkAssignment('admin-1', dto);

      expect(
        mockPredefinedTasksService.createBulkAssignment,
      ).toHaveBeenCalledWith('admin-1', dto);
      expect(result.created).toBe(4);
    });
  });

  describe('removeAssignment', () => {
    it('devrait supprimer une assignation', async () => {
      mockPredefinedTasksService.removeAssignment.mockResolvedValue({
        message: 'Assignation supprimée',
      });

      const result = await controller.removeAssignment('assignment-1');

      expect(mockPredefinedTasksService.removeAssignment).toHaveBeenCalledWith(
        'assignment-1',
      );
      expect(result).toEqual({ message: 'Assignation supprimée' });
    });
  });

  // ===========================
  // Règles Récurrentes
  // ===========================

  describe('findRecurringRules', () => {
    it('devrait retourner les règles récurrentes avec filtres', async () => {
      mockPredefinedTasksService.findRecurringRules.mockResolvedValue([
        mockRecurringRule,
      ]);

      const result = await controller.findRecurringRules('user-1', 'task-1');

      expect(
        mockPredefinedTasksService.findRecurringRules,
      ).toHaveBeenCalledWith({
        userId: 'user-1',
        predefinedTaskId: 'task-1',
      });
      expect(result).toEqual([mockRecurringRule]);
    });
  });

  describe('createRecurringRule', () => {
    it('devrait créer une règle récurrente', async () => {
      mockPredefinedTasksService.createRecurringRule.mockResolvedValue(
        mockRecurringRule,
      );

      const dto = {
        predefinedTaskId: 'task-1',
        userId: 'user-1',
        dayOfWeek: 0,
        period: 'FULL_DAY',
        startDate: '2026-01-06T00:00:00Z',
      };

      const result = await controller.createRecurringRule('admin-1', dto);

      expect(
        mockPredefinedTasksService.createRecurringRule,
      ).toHaveBeenCalledWith('admin-1', dto);
      expect(result).toEqual(mockRecurringRule);
    });
  });

  describe('updateRecurringRule', () => {
    it('devrait mettre à jour une règle récurrente', async () => {
      const updated = { ...mockRecurringRule, dayOfWeek: 2 };
      mockPredefinedTasksService.updateRecurringRule.mockResolvedValue(updated);

      const result = await controller.updateRecurringRule('rule-1', {
        dayOfWeek: 2,
      });

      expect(
        mockPredefinedTasksService.updateRecurringRule,
      ).toHaveBeenCalledWith('rule-1', {
        dayOfWeek: 2,
      });
      expect(result.dayOfWeek).toBe(2);
    });
  });

  describe('removeRecurringRule', () => {
    it('devrait supprimer une règle récurrente', async () => {
      mockPredefinedTasksService.removeRecurringRule.mockResolvedValue({
        message: 'Règle récurrente supprimée',
      });

      const result = await controller.removeRecurringRule('rule-1');

      expect(result).toEqual({ message: 'Règle récurrente supprimée' });
    });
  });

  describe('generateFromRules', () => {
    it('devrait déclencher la génération des assignations', async () => {
      const genResult = { created: 5, skipped: 1, rulesProcessed: 2 };
      mockPredefinedTasksService.generateFromRules.mockResolvedValue(genResult);

      const dto = {
        startDate: '2026-04-01T00:00:00Z',
        endDate: '2026-04-30T00:00:00Z',
      };

      const result = await controller.generateFromRules('admin-1', dto);

      expect(mockPredefinedTasksService.generateFromRules).toHaveBeenCalledWith(
        'admin-1',
        dto,
      );
      expect(result.created).toBe(5);
      expect(result.rulesProcessed).toBe(2);
    });
  });
});
