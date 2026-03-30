import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PredefinedTasksService } from './predefined-tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('PredefinedTasksService', () => {
  let service: PredefinedTasksService;

  const mockPrismaService = {
    predefinedTask: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    predefinedTaskAssignment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    predefinedTaskRecurringRule: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  const mockUser = {
    id: 'user-1',
    firstName: 'Jean',
    lastName: 'Dupont',
  };

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
    createdBy: mockUser,
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
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    predefinedTask: {
      id: 'task-1',
      name: 'Permanence accueil',
      color: '#3B82F6',
      icon: '🏢',
    },
    user: mockUser,
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
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    predefinedTask: {
      id: 'task-1',
      name: 'Permanence accueil',
      color: '#3B82F6',
      icon: '🏢',
    },
    user: mockUser,
    createdBy: { id: 'admin-1', firstName: 'Admin', lastName: 'System' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredefinedTasksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PredefinedTasksService>(PredefinedTasksService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================
  // Test 1 : Création d'une tâche prédéfinie
  // ===========================

  describe('create', () => {
    it('devrait créer une tâche prédéfinie avec les bonnes données', async () => {
      mockPrismaService.predefinedTask.create.mockResolvedValue(mockTask);

      const dto = {
        name: 'Permanence accueil',
        description: 'Accueil du public',
        color: '#3B82F6',
        icon: '🏢',
        defaultDuration: 'FULL_DAY',
      };

      const result = await service.create('user-1', dto);

      expect(mockPrismaService.predefinedTask.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          description: dto.description,
          color: dto.color,
          icon: dto.icon,
          defaultDuration: dto.defaultDuration,
          createdById: 'user-1',
        },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      expect(result).toEqual(mockTask);
    });

    it('devrait créer une tâche sans champs optionnels', async () => {
      const minimalTask = {
        ...mockTask,
        description: null,
        color: null,
        icon: null,
      };
      mockPrismaService.predefinedTask.create.mockResolvedValue(minimalTask);

      const dto = { name: 'Tâche simple', defaultDuration: 'HALF_DAY' };
      const result = await service.create('user-1', dto);

      expect(result.description).toBeNull();
      expect(result.defaultDuration).toBe('FULL_DAY');
    });
  });

  describe('findAll', () => {
    it('devrait retourner uniquement les tâches actives', async () => {
      mockPrismaService.predefinedTask.findMany.mockResolvedValue([mockTask]);

      const result = await service.findAll();

      expect(mockPrismaService.predefinedTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
      expect(result).toEqual([mockTask]);
    });
  });

  describe('update', () => {
    it('devrait lever NotFoundException si la tâche est introuvable', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(null);

      await expect(
        service.update('unknown-id', { name: 'Nouveau nom' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('devrait mettre à jour la tâche si elle existe', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      const updatedTask = { ...mockTask, name: 'Nouveau nom' };
      mockPrismaService.predefinedTask.update.mockResolvedValue(updatedTask);

      const result = await service.update('task-1', { name: 'Nouveau nom' });

      expect(result.name).toBe('Nouveau nom');
    });
  });

  describe('remove (soft delete)', () => {
    it('devrait désactiver la tâche (isActive=false)', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.predefinedTask.update.mockResolvedValue({
        ...mockTask,
        isActive: false,
      });

      await service.remove('task-1');

      expect(mockPrismaService.predefinedTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { isActive: false },
      });
    });

    it('devrait lever NotFoundException si la tâche est introuvable', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(null);

      await expect(service.remove('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ===========================
  // Test 2 : Assignation avec vérification
  // ===========================

  describe('createAssignment', () => {
    it('devrait créer une assignation quand la tâche existe', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.predefinedTaskAssignment.create.mockResolvedValue(
        mockAssignment,
      );

      const dto = {
        predefinedTaskId: 'task-1',
        userId: 'user-1',
        date: '2026-03-25T00:00:00Z',
        period: 'FULL_DAY',
      };

      const result = await service.createAssignment('admin-1', dto);

      expect(mockPrismaService.predefinedTask.findUnique).toHaveBeenCalledWith({
        where: { id: 'task-1' },
      });
      expect(
        mockPrismaService.predefinedTaskAssignment.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            predefinedTaskId: 'task-1',
            userId: 'user-1',
            period: 'FULL_DAY',
            assignedById: 'admin-1',
            isRecurring: false,
          }),
        }),
      );
      expect(result).toEqual(mockAssignment);
    });

    it('devrait lever NotFoundException si la tâche est inactive', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue({
        ...mockTask,
        isActive: false,
      });

      const dto = {
        predefinedTaskId: 'task-1',
        userId: 'user-1',
        date: '2026-03-25T00:00:00Z',
        period: 'FULL_DAY',
      };

      await expect(service.createAssignment('admin-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('devrait lever NotFoundException si la tâche est introuvable', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(null);

      const dto = {
        predefinedTaskId: 'task-unknown',
        userId: 'user-1',
        date: '2026-03-25T00:00:00Z',
        period: 'FULL_DAY',
      };

      await expect(service.createAssignment('admin-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('devrait lever ConflictException en cas de doublon (P2002)', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.predefinedTaskAssignment.create.mockRejectedValue({
        code: 'P2002',
      });

      const dto = {
        predefinedTaskId: 'task-1',
        userId: 'user-1',
        date: '2026-03-25T00:00:00Z',
        period: 'FULL_DAY',
      };

      await expect(service.createAssignment('admin-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('removeAssignment', () => {
    it('devrait supprimer une assignation existante', async () => {
      mockPrismaService.predefinedTaskAssignment.findUnique.mockResolvedValue(
        mockAssignment,
      );
      mockPrismaService.predefinedTaskAssignment.delete.mockResolvedValue(
        mockAssignment,
      );

      const result = await service.removeAssignment('assignment-1');

      expect(
        mockPrismaService.predefinedTaskAssignment.delete,
      ).toHaveBeenCalledWith({
        where: { id: 'assignment-1' },
      });
      expect(result).toEqual({ message: 'Assignation supprimée' });
    });

    it('devrait lever NotFoundException si assignation introuvable', async () => {
      mockPrismaService.predefinedTaskAssignment.findUnique.mockResolvedValue(
        null,
      );

      await expect(service.removeAssignment('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createBulkAssignment', () => {
    it('devrait créer des assignations pour chaque combinaison user × date', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.predefinedTaskAssignment.create.mockResolvedValue(
        mockAssignment,
      );

      const dto = {
        predefinedTaskId: 'task-1',
        userIds: ['user-1', 'user-2'],
        dates: ['2026-03-25T00:00:00Z', '2026-03-26T00:00:00Z'],
        period: 'FULL_DAY',
      };

      const result = await service.createBulkAssignment('admin-1', dto);

      // 2 users × 2 dates = 4 assignations
      expect(
        mockPrismaService.predefinedTaskAssignment.create,
      ).toHaveBeenCalledTimes(4);
      expect(result.created).toBe(4);
      expect(result.skipped).toBe(0);
    });

    it("devrait compter les doublons dans skipped sans lever d'erreur", async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.predefinedTaskAssignment.create
        .mockResolvedValueOnce(mockAssignment)
        .mockRejectedValueOnce({ code: 'P2002' });

      const dto = {
        predefinedTaskId: 'task-1',
        userIds: ['user-1'],
        dates: ['2026-03-25T00:00:00Z', '2026-03-26T00:00:00Z'],
        period: 'FULL_DAY',
      };

      const result = await service.createBulkAssignment('admin-1', dto);

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });

  // ===========================
  // Test 3 : Génération depuis une règle récurrente
  // ===========================

  describe('generateFromRules', () => {
    it('devrait générer les assignations pour les jours correspondants dans la plage', async () => {
      // Rule: Monday (dayOfWeek=0), FULL_DAY, starts 2026-01-01, no end
      const rule = {
        ...mockRecurringRule,
        dayOfWeek: 0, // Monday
        startDate: new Date('2026-01-01'),
        endDate: null,
      };

      mockPrismaService.predefinedTaskRecurringRule.findMany.mockResolvedValue([
        rule,
      ]);
      mockPrismaService.predefinedTaskAssignment.create.mockResolvedValue(
        mockAssignment,
      );

      // Range: 2026-03-23 (Monday) to 2026-03-29 (Sunday)
      const dto = {
        startDate: '2026-03-23T00:00:00Z',
        endDate: '2026-03-29T00:00:00Z',
      };

      const result = await service.generateFromRules('admin-1', dto);

      // Should create 1 Monday assignment (2026-03-23)
      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.rulesProcessed).toBe(1);
    });

    it('devrait sauter les assignations déjà existantes (P2002)', async () => {
      const rule = {
        ...mockRecurringRule,
        dayOfWeek: 0, // Monday
        startDate: new Date('2026-01-01'),
        endDate: null,
      };

      mockPrismaService.predefinedTaskRecurringRule.findMany.mockResolvedValue([
        rule,
      ]);
      mockPrismaService.predefinedTaskAssignment.create.mockRejectedValue({
        code: 'P2002',
      });

      const dto = {
        startDate: '2026-03-23T00:00:00Z',
        endDate: '2026-03-23T00:00:00Z',
      };

      const result = await service.generateFromRules('admin-1', dto);

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('devrait ne rien générer si aucune règle active ne couvre la plage', async () => {
      mockPrismaService.predefinedTaskRecurringRule.findMany.mockResolvedValue(
        [],
      );

      const dto = {
        startDate: '2026-03-23T00:00:00Z',
        endDate: '2026-03-29T00:00:00Z',
      };

      const result = await service.generateFromRules('admin-1', dto);

      expect(result.created).toBe(0);
      expect(result.rulesProcessed).toBe(0);
    });

    it("ne devrait pas créer d'assignation si la date est hors de la fenêtre de la règle", async () => {
      // Rule valid from 2026-04-01 onwards
      const rule = {
        ...mockRecurringRule,
        dayOfWeek: 0, // Monday
        startDate: new Date('2026-04-01'),
        endDate: null,
      };

      mockPrismaService.predefinedTaskRecurringRule.findMany.mockResolvedValue([
        rule,
      ]);
      mockPrismaService.predefinedTaskAssignment.create.mockResolvedValue(
        mockAssignment,
      );

      // Range: 2026-03-23 (Monday) - before rule start
      const dto = {
        startDate: '2026-03-23T00:00:00Z',
        endDate: '2026-03-23T00:00:00Z',
      };

      const result = await service.generateFromRules('admin-1', dto);

      // Despite the rule having dayOfWeek=0 (Monday) and 2026-03-23 being a Monday,
      // the rule doesn't start until 2026-04-01
      expect(result.created).toBe(0);
    });
  });

  // ===========================
  // Règles Récurrentes — autres tests
  // ===========================

  describe('createRecurringRule', () => {
    it('devrait créer une règle récurrente', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.predefinedTaskRecurringRule.create.mockResolvedValue(
        mockRecurringRule,
      );

      const dto = {
        predefinedTaskId: 'task-1',
        userId: 'user-1',
        dayOfWeek: 0,
        period: 'FULL_DAY',
        startDate: '2026-01-06T00:00:00Z',
      };

      const result = await service.createRecurringRule('admin-1', dto);

      expect(
        mockPrismaService.predefinedTaskRecurringRule.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            predefinedTaskId: 'task-1',
            userId: 'user-1',
            dayOfWeek: 0,
            period: 'FULL_DAY',
            createdById: 'admin-1',
            isActive: true,
          }),
        }),
      );
      expect(result).toEqual(mockRecurringRule);
    });

    it('devrait lever NotFoundException si la tâche est introuvable', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(null);

      const dto = {
        predefinedTaskId: 'task-unknown',
        userId: 'user-1',
        dayOfWeek: 0,
        period: 'FULL_DAY',
        startDate: '2026-01-06T00:00:00Z',
      };

      await expect(service.createRecurringRule('admin-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createRecurringRule with weekInterval', () => {
    it('devrait créer une règle récurrente avec weekInterval', async () => {
      const ruleWithInterval = { ...mockRecurringRule, weekInterval: 2 };
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.predefinedTaskRecurringRule.create.mockResolvedValue(ruleWithInterval);

      const dto = {
        predefinedTaskId: 'task-1',
        userId: 'user-1',
        dayOfWeek: 0,
        period: 'FULL_DAY',
        startDate: '2026-01-06T00:00:00Z',
        weekInterval: 2,
      };

      const result = await service.createRecurringRule('admin-1', dto);

      expect(mockPrismaService.predefinedTaskRecurringRule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            weekInterval: 2,
          }),
        }),
      );
      expect(result.weekInterval).toBe(2);
    });

    it('devrait utiliser weekInterval=1 par défaut', async () => {
      const ruleDefault = { ...mockRecurringRule, weekInterval: 1 };
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.predefinedTaskRecurringRule.create.mockResolvedValue(ruleDefault);

      const dto = {
        predefinedTaskId: 'task-1',
        userId: 'user-1',
        dayOfWeek: 0,
        period: 'FULL_DAY',
        startDate: '2026-01-06T00:00:00Z',
      };

      const result = await service.createRecurringRule('admin-1', dto);

      expect(result.weekInterval).toBe(1);
    });
  });

  describe('updateRecurringRule', () => {
    it('devrait mettre à jour une règle existante', async () => {
      mockPrismaService.predefinedTaskRecurringRule.findUnique.mockResolvedValue(
        mockRecurringRule,
      );
      const updated = { ...mockRecurringRule, dayOfWeek: 2 };
      mockPrismaService.predefinedTaskRecurringRule.update.mockResolvedValue(
        updated,
      );

      const result = await service.updateRecurringRule('rule-1', {
        dayOfWeek: 2,
      });

      expect(result.dayOfWeek).toBe(2);
    });

    it('devrait lever NotFoundException si règle introuvable', async () => {
      mockPrismaService.predefinedTaskRecurringRule.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.updateRecurringRule('unknown-id', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeRecurringRule', () => {
    it('devrait supprimer une règle existante', async () => {
      mockPrismaService.predefinedTaskRecurringRule.findUnique.mockResolvedValue(
        mockRecurringRule,
      );
      mockPrismaService.predefinedTaskRecurringRule.delete.mockResolvedValue(
        mockRecurringRule,
      );

      const result = await service.removeRecurringRule('rule-1');

      expect(result).toEqual({ message: 'Règle récurrente supprimée' });
    });

    it('devrait lever NotFoundException si règle introuvable', async () => {
      mockPrismaService.predefinedTaskRecurringRule.findUnique.mockResolvedValue(
        null,
      );

      await expect(service.removeRecurringRule('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
