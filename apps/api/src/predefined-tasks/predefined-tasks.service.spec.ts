import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PredefinedTasksService } from './predefined-tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { CreatePredefinedTaskDto } from './dto/create-predefined-task.dto';
import { UpdateCompletionStatusDto } from './dto/update-completion-status.dto';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { PermissionsService } from '../rbac/permissions.service';

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
    service: {
      findMany: vi.fn(),
    },
    userService: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const mockAuditPersistenceService = {
    log: vi.fn(),
  };

  const mockPermissionsService = {
    getPermissionsForRole: vi.fn(),
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
    weight: 1,
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
    recurrenceType: 'WEEKLY',
    dayOfWeek: 0,
    weekInterval: 1,
    monthlyOrdinal: null,
    monthlyDayOfMonth: null,
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
        {
          provide: AuditPersistenceService,
          useValue: mockAuditPersistenceService,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
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
          startTime: null,
          endTime: null,
          isExternalIntervention: false,
          weight: 1,
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

  // ===========================
  // Test weight field (W1.3)
  // ===========================

  describe('weight — service.create()', () => {
    it('a. devrait passer weight:3 à Prisma et retourner une tâche avec weight=3', async () => {
      const taskWithWeight3 = { ...mockTask, weight: 3 };
      mockPrismaService.predefinedTask.create.mockResolvedValue(taskWithWeight3);

      const dto = {
        name: 'Permanence accueil',
        description: 'Accueil du public',
        color: '#3B82F6',
        icon: '🏢',
        defaultDuration: 'FULL_DAY',
        weight: 3,
      };

      const result = await service.create('user-1', dto);

      expect(mockPrismaService.predefinedTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ weight: 3 }),
        }),
      );
      expect(result.weight).toBe(3);
    });

    it('b. devrait utiliser weight=1 par défaut si absent du DTO', async () => {
      const taskWithWeight1 = { ...mockTask, weight: 1 };
      mockPrismaService.predefinedTask.create.mockResolvedValue(taskWithWeight1);

      const dto = {
        name: 'Permanence accueil',
        defaultDuration: 'FULL_DAY',
      };

      const result = await service.create('user-1', dto);

      // Le service applique explicitement `dto.weight ?? 1`, donc Prisma reçoit
      // weight=1 à coup sûr. Vérification stricte pour que toute régression
      // retirant le default côté service soit attrapée (vs. laisser le seul
      // DB default, qui masquerait l'erreur côté API contract).
      const callArg = mockPrismaService.predefinedTask.create.mock.calls[0][0];
      expect(callArg.data.weight).toBe(1);
      expect(result.weight).toBe(1);
    });
  });

  describe('weight — service.update()', () => {
    it('c. devrait passer weight:5 à Prisma lors du update', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      const updatedTask = { ...mockTask, weight: 5 };
      mockPrismaService.predefinedTask.update.mockResolvedValue(updatedTask);

      const result = await service.update('task-1', { weight: 5 });

      expect(mockPrismaService.predefinedTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ weight: 5 }),
        }),
      );
      expect(result.weight).toBe(5);
    });

    it("d. ne devrait PAS inclure weight dans les data Prisma si absent du DTO d'update", async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.predefinedTask.update.mockResolvedValue(mockTask);

      await service.update('task-1', { name: 'Nouveau nom' });

      const callArg = mockPrismaService.predefinedTask.update.mock.calls[0][0];
      expect(callArg.data).not.toHaveProperty('weight');
    });
  });

  describe('weight — DTO validation', () => {
    it('e1. devrait rejeter weight=6 (> Max 5)', async () => {
      const dto = plainToInstance(CreatePredefinedTaskDto, {
        name: 'Test',
        defaultDuration: 'FULL_DAY',
        weight: 6,
      });
      const errors = await validate(dto);
      const weightError = errors.find((e) => e.property === 'weight');
      expect(weightError).toBeDefined();
    });

    it('e2. devrait rejeter weight=0 (< Min 1)', async () => {
      const dto = plainToInstance(CreatePredefinedTaskDto, {
        name: 'Test',
        defaultDuration: 'FULL_DAY',
        weight: 0,
      });
      const errors = await validate(dto);
      const weightError = errors.find((e) => e.property === 'weight');
      expect(weightError).toBeDefined();
    });

    it('f. devrait rejeter weight=3.5 (non entier)', async () => {
      const dto = plainToInstance(CreatePredefinedTaskDto, {
        name: 'Test',
        defaultDuration: 'FULL_DAY',
        weight: 3.5,
      });
      const errors = await validate(dto);
      const weightError = errors.find((e) => e.property === 'weight');
      expect(weightError).toBeDefined();
    });

    it('devrait accepter weight absent (optionnel)', async () => {
      const dto = plainToInstance(CreatePredefinedTaskDto, {
        name: 'Test',
        defaultDuration: 'FULL_DAY',
      });
      const errors = await validate(dto);
      const weightError = errors.find((e) => e.property === 'weight');
      expect(weightError).toBeUndefined();
    });

    it('devrait accepter weight=1 (valeur minimale valide)', async () => {
      const dto = plainToInstance(CreatePredefinedTaskDto, {
        name: 'Test',
        defaultDuration: 'FULL_DAY',
        weight: 1,
      });
      const errors = await validate(dto);
      const weightError = errors.find((e) => e.property === 'weight');
      expect(weightError).toBeUndefined();
    });

    it('devrait accepter weight=5 (valeur maximale valide)', async () => {
      const dto = plainToInstance(CreatePredefinedTaskDto, {
        name: 'Test',
        defaultDuration: 'FULL_DAY',
        weight: 5,
      });
      const errors = await validate(dto);
      const weightError = errors.find((e) => e.property === 'weight');
      expect(weightError).toBeUndefined();
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

  describe('generateFromRules with weekInterval', () => {
    it('devrait respecter weekInterval=2 (bihebdo) et ne generer que les semaines paires', async () => {
      const biweeklyRule = {
        ...mockRecurringRule,
        id: 'rule-biweekly',
        dayOfWeek: 0,
        weekInterval: 2,
        startDate: new Date('2026-01-05'),
        endDate: null,
      };
      mockPrismaService.predefinedTaskRecurringRule.findMany.mockResolvedValue([
        biweeklyRule,
      ]);
      mockPrismaService.predefinedTaskAssignment.create.mockResolvedValue(
        mockAssignment,
      );

      const result = await service.generateFromRules('admin-1', {
        startDate: '2026-01-05T00:00:00Z',
        endDate: '2026-01-31T00:00:00Z',
      });

      // 4 Mondays: Jan 5, 12, 19, 26
      // weekInterval=2, anchor=Jan 5: week 0 (YES), week 1 (NO), week 2 (YES), week 3 (NO)
      expect(result.created).toBe(2);
      expect(
        mockPrismaService.predefinedTaskAssignment.create,
      ).toHaveBeenCalledTimes(2);
    });

    it('devrait generer chaque semaine quand weekInterval=1', async () => {
      const weeklyRule = {
        ...mockRecurringRule,
        id: 'rule-weekly',
        dayOfWeek: 0,
        weekInterval: 1,
        startDate: new Date('2026-01-05'),
        endDate: null,
      };
      mockPrismaService.predefinedTaskRecurringRule.findMany.mockResolvedValue([
        weeklyRule,
      ]);
      mockPrismaService.predefinedTaskAssignment.create.mockResolvedValue(
        mockAssignment,
      );

      const result = await service.generateFromRules('admin-1', {
        startDate: '2026-01-05T00:00:00Z',
        endDate: '2026-01-31T00:00:00Z',
      });

      expect(result.created).toBe(4);
    });

    it('devrait calculer weekInterval relativement au startDate de la regle', async () => {
      const rule = {
        ...mockRecurringRule,
        dayOfWeek: 0,
        weekInterval: 2,
        startDate: new Date('2026-01-05'),
        endDate: null,
      };
      mockPrismaService.predefinedTaskRecurringRule.findMany.mockResolvedValue([
        rule,
      ]);
      mockPrismaService.predefinedTaskAssignment.create.mockResolvedValue(
        mockAssignment,
      );

      const result = await service.generateFromRules('admin-1', {
        startDate: '2026-01-19T00:00:00Z',
        endDate: '2026-02-15T00:00:00Z',
      });

      // Mondays: Jan 19, 26, Feb 2, 9
      // Weeks since anchor (Jan 5): 2, 3, 4, 5
      // 2%2=0 YES, 3%2=1 NO, 4%2=0 YES, 5%2=1 NO
      expect(result.created).toBe(2);
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
      mockPrismaService.predefinedTaskRecurringRule.create.mockResolvedValue(
        ruleWithInterval,
      );

      const dto = {
        predefinedTaskId: 'task-1',
        userId: 'user-1',
        dayOfWeek: 0,
        period: 'FULL_DAY',
        startDate: '2026-01-06T00:00:00Z',
        weekInterval: 2,
      };

      const result = await service.createRecurringRule('admin-1', dto);

      expect(
        mockPrismaService.predefinedTaskRecurringRule.create,
      ).toHaveBeenCalledWith(
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
      mockPrismaService.predefinedTaskRecurringRule.create.mockResolvedValue(
        ruleDefault,
      );

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

  describe('bulkCreateRecurringRules', () => {
    it('devrait creer N users x M jours regles atomiques', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      (mockPrismaService as any).$transaction = vi.fn(
        async (callback: (tx: any) => Promise<any>) => {
          return callback(mockPrismaService);
        },
      );
      mockPrismaService.predefinedTaskRecurringRule.create.mockResolvedValue(
        mockRecurringRule,
      );

      const dto = {
        predefinedTaskId: 'task-1',
        userIds: ['user-1', 'user-2'],
        daysOfWeek: [0, 2],
        period: 'FULL_DAY',
        weekInterval: 2,
        startDate: '2026-01-06T00:00:00Z',
      };

      const result = await service.bulkCreateRecurringRules('admin-1', dto);

      expect(result.created).toBe(4);
      expect(
        mockPrismaService.predefinedTaskRecurringRule.create,
      ).toHaveBeenCalledTimes(4);
    });

    it('devrait lever NotFoundException si la tache est inactive', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue({
        ...mockTask,
        isActive: false,
      });

      const dto = {
        predefinedTaskId: 'task-1',
        userIds: ['user-1'],
        daysOfWeek: [0],
        period: 'FULL_DAY',
        startDate: '2026-01-06T00:00:00Z',
      };

      await expect(
        service.bulkCreateRecurringRules('admin-1', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('devrait utiliser weekInterval=1 par defaut', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      (mockPrismaService as any).$transaction = vi.fn(
        async (callback: (tx: any) => Promise<any>) => {
          return callback(mockPrismaService);
        },
      );
      mockPrismaService.predefinedTaskRecurringRule.create.mockResolvedValue(
        mockRecurringRule,
      );

      const dto = {
        predefinedTaskId: 'task-1',
        userIds: ['user-1'],
        daysOfWeek: [0],
        period: 'FULL_DAY',
        startDate: '2026-01-06T00:00:00Z',
      };

      await service.bulkCreateRecurringRules('admin-1', dto);

      expect(
        mockPrismaService.predefinedTaskRecurringRule.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            weekInterval: 1,
          }),
        }),
      );
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

  // ===========================
  // DTO UpdateCompletionStatusDto — validation
  // ===========================

  describe('UpdateCompletionStatusDto — validation', () => {
    it('DTO-1: status DONE sans reason → valide', async () => {
      const dto = plainToInstance(UpdateCompletionStatusDto, {
        status: 'DONE',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('DTO-2: status NOT_APPLICABLE sans reason → erreur (reason requise)', async () => {
      const dto = plainToInstance(UpdateCompletionStatusDto, {
        status: 'NOT_APPLICABLE',
      });
      const errors = await validate(dto);
      const reasonError = errors.find((e) => e.property === 'reason');
      expect(reasonError).toBeDefined();
    });

    it('DTO-3: status NOT_APPLICABLE avec reason ≥ 3 chars → valide', async () => {
      const dto = plainToInstance(UpdateCompletionStatusDto, {
        status: 'NOT_APPLICABLE',
        reason: 'abc',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('DTO-4: status INVALID → erreur IsIn', async () => {
      const dto = plainToInstance(UpdateCompletionStatusDto, {
        status: 'INVALID',
      });
      const errors = await validate(dto);
      const statusError = errors.find((e) => e.property === 'status');
      expect(statusError).toBeDefined();
    });
  });

  // ===========================
  // updateCompletionStatus — tests service
  // ===========================

  describe('updateCompletionStatus', () => {
    const ownerUser = {
      id: 'user-1',
      role: { code: 'CONTRIBUTEUR', templateKey: 'CONTRIBUTEUR', id: 'r1', label: 'Contributeur', isSystem: true },
    };

    const managerUser = {
      id: 'manager-1',
      role: { code: 'MANAGER', templateKey: 'MANAGER', id: 'r2', label: 'Manager', isSystem: true },
    };

    const assignmentNotDone = {
      id: 'assignment-1',
      userId: 'user-1',
      predefinedTaskId: 'task-1',
      completionStatus: 'NOT_DONE',
      completedAt: null,
      completedById: null,
      notApplicableReason: null,
      date: new Date('2026-04-24'),
      period: 'FULL_DAY',
      assignedById: 'manager-1',
      isRecurring: false,
      recurringRuleId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const assignmentDone = {
      ...assignmentNotDone,
      completionStatus: 'DONE',
      completedAt: new Date(),
      completedById: 'user-1',
    };

    it('a. propriétaire marque NOT_DONE → DONE : ok, audit log créé', async () => {
      mockPrismaService.predefinedTaskAssignment.findUnique.mockResolvedValue(
        assignmentNotDone,
      );
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'predefined_tasks:update-own-status',
        'predefined_tasks:view',
      ]);
      const updatedAssignment = { ...assignmentNotDone, completionStatus: 'DONE', completedAt: expect.any(Date), completedById: 'user-1' };
      mockPrismaService.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrismaService) => Promise<unknown>) => cb(mockPrismaService),
      );
      mockPrismaService.predefinedTaskAssignment.update.mockResolvedValue(updatedAssignment);
      mockAuditPersistenceService.log.mockResolvedValue(undefined);

      const result = await service.updateCompletionStatus(
        'assignment-1',
        { status: 'DONE' },
        ownerUser as any,
      );

      expect(result.completionStatus).toBe('DONE');
      expect(mockAuditPersistenceService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ASSIGNMENT_STATUS_CHANGED',
          entityId: 'assignment-1',
          actorId: 'user-1',
          payload: expect.objectContaining({ before: 'NOT_DONE', after: 'DONE' }),
        }),
      );
    });

    it('b. non-propriétaire sans permission → ForbiddenException', async () => {
      const otherAssignment = { ...assignmentNotDone, userId: 'user-OTHER' };
      mockPrismaService.predefinedTaskAssignment.findUnique.mockResolvedValue(otherAssignment);
      // manager n'a que update-own-status, pas update-any-status
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'predefined_tasks:update-own-status',
      ]);

      await expect(
        service.updateCompletionStatus('assignment-1', { status: 'DONE' }, ownerUser as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('c. non-propriétaire avec update-any-status mais user hors périmètre → ForbiddenException', async () => {
      const otherAssignment = { ...assignmentNotDone, userId: 'user-OTHER' };
      mockPrismaService.predefinedTaskAssignment.findUnique.mockResolvedValue(otherAssignment);
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'predefined_tasks:update-own-status',
        'predefined_tasks:update-any-status',
      ]);
      // manager ne gère aucun service
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.userService.findMany.mockResolvedValue([]);

      await expect(
        service.updateCompletionStatus('assignment-1', { status: 'DONE' }, managerUser as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('d. transition DONE → IN_PROGRESS (invalide) → ConflictException', async () => {
      const donAssignment = { ...assignmentNotDone, completionStatus: 'DONE' };
      mockPrismaService.predefinedTaskAssignment.findUnique.mockResolvedValue(donAssignment);
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'predefined_tasks:update-own-status',
      ]);

      await expect(
        service.updateCompletionStatus('assignment-1', { status: 'IN_PROGRESS' }, ownerUser as any),
      ).rejects.toThrow(ConflictException);
    });

    it('e. transition NOT_DONE → NOT_APPLICABLE sans reason → erreur DTO (BadRequest)', async () => {
      const dto = plainToInstance(UpdateCompletionStatusDto, {
        status: 'NOT_APPLICABLE',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('f. NOT_FOUND sur id inexistant → NotFoundException', async () => {
      mockPrismaService.predefinedTaskAssignment.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCompletionStatus('unknown-id', { status: 'DONE' }, ownerUser as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('g. audit log inséré à chaque transition réussie', async () => {
      mockPrismaService.predefinedTaskAssignment.findUnique.mockResolvedValue(
        assignmentNotDone,
      );
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'predefined_tasks:update-own-status',
      ]);
      const updated = { ...assignmentNotDone, completionStatus: 'IN_PROGRESS' };
      mockPrismaService.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrismaService) => Promise<unknown>) => cb(mockPrismaService),
      );
      mockPrismaService.predefinedTaskAssignment.update.mockResolvedValue(updated);
      mockAuditPersistenceService.log.mockResolvedValue(undefined);

      await service.updateCompletionStatus(
        'assignment-1',
        { status: 'IN_PROGRESS' },
        ownerUser as any,
      );

      expect(mockAuditPersistenceService.log).toHaveBeenCalledTimes(1);
    });
  });
});
