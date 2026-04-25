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
  BadRequestException,
} from '@nestjs/common';
import { CreatePredefinedTaskDto } from './dto/create-predefined-task.dto';
import { CreateRecurringRuleDto } from './dto/create-recurring-rule.dto';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { PermissionsService } from '../rbac/permissions.service';
import { PlanningBalancerService } from './planning-balancer.service';
import { LeavesService } from '../leaves/leaves.service';

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
      createMany: vi.fn(),
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

  const mockPlanningBalancerService = {
    balance: vi.fn(),
  };

  const mockLeavesService = {
    findAll: vi.fn(),
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
        {
          provide: PlanningBalancerService,
          useValue: mockPlanningBalancerService,
        },
        {
          provide: LeavesService,
          useValue: mockLeavesService,
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

    it('régression weekInterval : weekInterval:3 est transmis à Prisma update', async () => {
      mockPrismaService.predefinedTaskRecurringRule.findUnique.mockResolvedValue(
        mockRecurringRule,
      );
      const updated = { ...mockRecurringRule, weekInterval: 3 };
      mockPrismaService.predefinedTaskRecurringRule.update.mockResolvedValue(
        updated,
      );

      await service.updateRecurringRule('rule-1', { weekInterval: 3 });

      expect(
        mockPrismaService.predefinedTaskRecurringRule.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ weekInterval: 3 }),
        }),
      );
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

  describe('CreateRecurringRuleDto — cross-field validator (@IsValidRecurrenceConfig)', () => {
    const baseValid = {
      predefinedTaskId: 'uuid-task-1',
      userId: 'uuid-user-1',
      period: 'FULL_DAY',
      startDate: '2026-01-06T00:00:00Z',
    };

    it('CV-1: WEEKLY sans dayOfWeek → erreur cross-field', async () => {
      const dto = plainToInstance(CreateRecurringRuleDto, {
        ...baseValid,
        recurrenceType: 'WEEKLY',
        // dayOfWeek absent intentionnellement
      });
      const errors = await validate(dto);
      const crossError = errors.find((e) => e.property === 'recurrenceType');
      expect(crossError).toBeDefined();
    });

    it("CV-2: WEEKLY avec dayOfWeek=0 → valide (pas d'erreur cross-field)", async () => {
      const dto = plainToInstance(CreateRecurringRuleDto, {
        ...baseValid,
        recurrenceType: 'WEEKLY',
        dayOfWeek: 0,
      });
      const errors = await validate(dto);
      const crossError = errors.find((e) => e.property === 'recurrenceType');
      expect(crossError).toBeUndefined();
    });

    it('CV-3: MONTHLY_DAY avec dayOfWeek présent → erreur cross-field', async () => {
      const dto = plainToInstance(CreateRecurringRuleDto, {
        ...baseValid,
        recurrenceType: 'MONTHLY_DAY',
        monthlyDayOfMonth: 15,
        dayOfWeek: 1, // interdit pour MONTHLY_DAY
      });
      const errors = await validate(dto);
      const crossError = errors.find((e) => e.property === 'recurrenceType');
      expect(crossError).toBeDefined();
    });

    it('CV-4: MONTHLY_DAY sans monthlyDayOfMonth → erreur cross-field', async () => {
      const dto = plainToInstance(CreateRecurringRuleDto, {
        ...baseValid,
        recurrenceType: 'MONTHLY_DAY',
        // monthlyDayOfMonth absent
      });
      const errors = await validate(dto);
      const crossError = errors.find((e) => e.property === 'recurrenceType');
      expect(crossError).toBeDefined();
    });

    it("CV-5: MONTHLY_DAY valide (monthlyDayOfMonth=15, sans dayOfWeek) → pas d'erreur", async () => {
      const dto = plainToInstance(CreateRecurringRuleDto, {
        ...baseValid,
        recurrenceType: 'MONTHLY_DAY',
        monthlyDayOfMonth: 15,
      });
      const errors = await validate(dto);
      const crossError = errors.find((e) => e.property === 'recurrenceType');
      expect(crossError).toBeUndefined();
    });

    it('CV-6: MONTHLY_ORDINAL sans monthlyOrdinal → erreur cross-field', async () => {
      const dto = plainToInstance(CreateRecurringRuleDto, {
        ...baseValid,
        recurrenceType: 'MONTHLY_ORDINAL',
        dayOfWeek: 1,
        // monthlyOrdinal absent
      });
      const errors = await validate(dto);
      const crossError = errors.find((e) => e.property === 'recurrenceType');
      expect(crossError).toBeDefined();
    });

    it('CV-7: MONTHLY_ORDINAL sans dayOfWeek → erreur cross-field', async () => {
      const dto = plainToInstance(CreateRecurringRuleDto, {
        ...baseValid,
        recurrenceType: 'MONTHLY_ORDINAL',
        monthlyOrdinal: 3,
        // dayOfWeek absent
      });
      const errors = await validate(dto);
      const crossError = errors.find((e) => e.property === 'recurrenceType');
      expect(crossError).toBeDefined();
    });

    it("CV-8: MONTHLY_ORDINAL valide (monthlyOrdinal=3, dayOfWeek=1) → pas d'erreur", async () => {
      const dto = plainToInstance(CreateRecurringRuleDto, {
        ...baseValid,
        recurrenceType: 'MONTHLY_ORDINAL',
        monthlyOrdinal: 3,
        dayOfWeek: 1,
      });
      const errors = await validate(dto);
      const crossError = errors.find((e) => e.property === 'recurrenceType');
      expect(crossError).toBeUndefined();
    });
  });

  // ===========================
  // generateBalanced — W3.2
  // ===========================

  describe('generateBalanced', () => {
    const taskId1 = '11111111-1111-1111-1111-111111111111';
    const userId1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const userId2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    const mockActiveTask = {
      id: taskId1,
      name: 'Tâche test',
      isActive: true,
      weight: 2,
    };

    const mockRule = {
      id: 'rule-bal-1',
      predefinedTaskId: taskId1,
      userId: userId1,
      recurrenceType: 'WEEKLY',
      dayOfWeek: 0, // Lundi
      weekInterval: 1,
      monthlyOrdinal: null,
      monthlyDayOfMonth: null,
      period: 'MORNING',
      startDate: new Date('2026-04-01'),
      endDate: null,
      isActive: true,
    };

    const mockBalancerOutput = {
      proposedAssignments: [
        {
          taskId: taskId1,
          userId: userId1,
          date: new Date('2026-04-06'),
          period: 'MORNING',
          weight: 2,
        },
      ],
      workloadByAgent: [{ userId: userId1, weightedLoad: 2 }],
      equityRatio: 1,
      unassignedOccurrences: [],
    };

    const adminUser = {
      id: 'admin-uuid',
      role: { code: 'ADMIN', templateKey: 'ADMIN', id: 'r-admin', label: 'Admin', isSystem: true },
      permissions: ['projects:manage_any', 'predefined_tasks:balance'],
    };

    const responsableUser = {
      id: 'resp-uuid',
      role: { code: 'RESPONSABLE', templateKey: 'RESPONSABLE', id: 'r-resp', label: 'Responsable', isSystem: true },
      permissions: ['predefined_tasks:balance'],
    };

    beforeEach(() => {
      // Par défaut : tâches actives, règles, pas d'absences, balancer output
      mockPrismaService.predefinedTask.findMany.mockResolvedValue([mockActiveTask]);
      mockPrismaService.predefinedTaskRecurringRule.findMany.mockResolvedValue([mockRule]);
      mockLeavesService.findAll.mockResolvedValue([]);
      mockPlanningBalancerService.balance.mockReturnValue(mockBalancerOutput);
      // Pour RBAC scope : service.findMany et userService.findMany
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.userService.findMany.mockResolvedValue([]);
    });

    it('GB-1: mode preview — renvoie balancerOutput sans écrire en DB', async () => {
      const dto = {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        userIds: [userId1],
        taskIds: [taskId1],
        mode: 'preview' as const,
      };

      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:manage_any',
        'predefined_tasks:balance',
      ]);

      const result = await service.generateBalanced(dto, adminUser as any);

      expect(result.mode).toBe('preview');
      expect(result.assignmentsCreated).toBe(0);
      expect(result.proposedAssignments).toHaveLength(1);
      expect(mockPrismaService.predefinedTaskAssignment.createMany).not.toHaveBeenCalled();
      expect(mockAuditPersistenceService.log).not.toHaveBeenCalled();
    });

    it('GB-2: mode apply — createMany appelé avec skipDuplicates, audit log BALANCER_APPLIED inséré', async () => {
      const dto = {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        userIds: [userId1],
        taskIds: [taskId1],
        mode: 'apply' as const,
      };

      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:manage_any',
        'predefined_tasks:balance',
      ]);

      const txMock = {
        predefinedTaskAssignment: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
      mockPrismaService.$transaction.mockImplementation(
        async (cb: (tx: any) => Promise<any>) => cb(txMock),
      );
      mockAuditPersistenceService.log.mockResolvedValue(undefined);

      const result = await service.generateBalanced(dto, adminUser as any);

      expect(result.mode).toBe('apply');
      expect(result.assignmentsCreated).toBe(1);
      expect(txMock.predefinedTaskAssignment.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true }),
      );
      expect(mockAuditPersistenceService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BALANCER_APPLIED' }),
      );
    });

    it('GB-3: idempotence — replay apply → createMany appelé, count=0 (skipDuplicates)', async () => {
      const dto = {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        userIds: [userId1],
        taskIds: [taskId1],
        mode: 'apply' as const,
      };

      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:manage_any',
        'predefined_tasks:balance',
      ]);

      const txMock = {
        predefinedTaskAssignment: {
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      mockPrismaService.$transaction.mockImplementation(
        async (cb: (tx: any) => Promise<any>) => cb(txMock),
      );
      mockAuditPersistenceService.log.mockResolvedValue(undefined);

      const result = await service.generateBalanced(dto, adminUser as any);

      expect(txMock.predefinedTaskAssignment.createMany).toHaveBeenCalled();
      expect(result.assignmentsCreated).toBe(0);
    });

    it('GB-4: RBAC scope — RESPONSABLE, userIds hors périmètre → ForbiddenException', async () => {
      const outOfScopeUserId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
      const dto = {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        userIds: [outOfScopeUserId],
        taskIds: [taskId1],
        mode: 'preview' as const,
      };

      // RESPONSABLE n'a pas projects:manage_any
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'predefined_tasks:balance',
      ]);
      // Périmètre du RESPONSABLE : ne contient pas outOfScopeUserId
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.userService.findMany.mockResolvedValue([]);

      await expect(
        service.generateBalanced(dto, responsableUser as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('GB-5: ADMIN global (projects:manage_any) peut balancer n\'importe quel user', async () => {
      const dto = {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        userIds: [userId1, userId2],
        taskIds: [taskId1],
        mode: 'preview' as const,
      };

      // ADMIN a projects:manage_any → pas de vérification de périmètre
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:manage_any',
        'predefined_tasks:balance',
      ]);
      mockPrismaService.predefinedTaskRecurringRule.findMany.mockResolvedValue([]);
      mockPlanningBalancerService.balance.mockReturnValue({
        ...mockBalancerOutput,
        proposedAssignments: [],
        workloadByAgent: [
          { userId: userId1, weightedLoad: 0 },
          { userId: userId2, weightedLoad: 0 },
        ],
      });

      const result = await service.generateBalanced(dto, adminUser as any);

      expect(result).toBeDefined();
      // Pas de ForbiddenException
    });

    it('GB-6: taskId inexistant ou isActive=false → NotFoundException', async () => {
      const dto = {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        userIds: [userId1],
        taskIds: ['99999999-9999-9999-9999-999999999999'],
        mode: 'preview' as const,
      };

      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:manage_any',
      ]);
      // Tâche non trouvée (findMany retourne tableau vide — taskId absent)
      mockPrismaService.predefinedTask.findMany.mockResolvedValue([]);

      await expect(
        service.generateBalanced(dto, adminUser as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('GB-7: ni serviceId ni userIds → BadRequestException', async () => {
      const dto = {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        taskIds: [taskId1],
        mode: 'preview' as const,
      } as any;

      await expect(
        service.generateBalanced(dto, adminUser as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('GB-8: serviceId + userIds → intersection filtrée sur membres du service', async () => {
      const serviceId = 'srv-1111-1111-1111-111111111111';
      const dto = {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        serviceId,
        userIds: [userId1, userId2],
        taskIds: [taskId1],
        mode: 'preview' as const,
      };

      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:manage_any',
      ]);

      // Le service contient uniquement userId1 (userId2 hors service → filtré)
      mockPrismaService.userService.findMany.mockImplementation((args: any) => {
        if (args?.where?.serviceId === serviceId) {
          // membres du service demandé
          return Promise.resolve([{ userId: userId1 }]);
        }
        if (args?.where?.userId) {
          // services d'appartenance du currentUser (pour getManagedUserIds)
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.predefinedTaskRecurringRule.findMany.mockResolvedValue([]);
      mockPlanningBalancerService.balance.mockReturnValue({
        ...mockBalancerOutput,
        proposedAssignments: [],
        workloadByAgent: [{ userId: userId1, weightedLoad: 0 }],
      });

      const result = await service.generateBalanced(dto, adminUser as any);

      // balance() appelé avec uniquement userId1 dans agents (userId2 filtré)
      const balanceCall = mockPlanningBalancerService.balance.mock.calls[0][0];
      expect(balanceCall.agents).toHaveLength(1);
      expect(balanceCall.agents[0].userId).toBe(userId1);
      expect(result).toBeDefined();
    });

    it('GB-9: transaction rollback — createMany throw → audit log NOT créé', async () => {
      const dto = {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        userIds: [userId1],
        taskIds: [taskId1],
        mode: 'apply' as const,
      };

      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:manage_any',
      ]);

      const txMock = {
        predefinedTaskAssignment: {
          createMany: vi.fn().mockRejectedValue(new Error('DB error')),
        },
      };
      mockPrismaService.$transaction.mockImplementation(
        async (cb: (tx: any) => Promise<any>) => cb(txMock),
      );

      await expect(
        service.generateBalanced(dto, adminUser as any),
      ).rejects.toThrow('DB error');

      // Audit log PAS créé car transaction a échoué (audit est DANS la transaction)
      expect(mockAuditPersistenceService.log).not.toHaveBeenCalled();
    });
  });
});
