import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, ThirdPartyType } from 'database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessScopeService } from '../common/services/access-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateThirdPartyDto } from './dto/create-third-party.dto';
import { ThirdPartiesService } from './third-parties.service';

describe('ThirdPartiesService', () => {
  let service: ThirdPartiesService;

  const mockPrismaService = {
    thirdParty: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    task: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    taskThirdPartyAssignee: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    projectThirdPartyMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    timeEntry: {
      count: vi.fn(),
    },
    $transaction: vi.fn(async (queries: unknown) => {
      if (Array.isArray(queries)) return Promise.all(queries);
      return (queries as (tx: typeof mockPrismaService) => unknown)(
        mockPrismaService,
      );
    }),
  };

  const mockAccessScope = {
    assertCanReadTask: vi.fn().mockResolvedValue(undefined),
    assertCanAccessProject: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThirdPartiesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AccessScopeService, useValue: mockAccessScope },
      ],
    }).compile();
    service = module.get<ThirdPartiesService>(ThirdPartiesService);
  });

  describe('create', () => {
    it('creates EXTERNAL_PROVIDER with optional contact', async () => {
      const dto: CreateThirdPartyDto = {
        type: ThirdPartyType.EXTERNAL_PROVIDER,
        organizationName: 'Acme',
        contactFirstName: 'Jane',
        contactLastName: 'Doe',
      };
      mockPrismaService.thirdParty.create.mockResolvedValue({
        id: 'tp-1',
        ...dto,
      });
      const result = await service.create(dto, 'user-1');
      expect(result).toBeDefined();
      expect(mockPrismaService.thirdParty.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: ThirdPartyType.EXTERNAL_PROVIDER,
          createdById: 'user-1',
        }),
      });
    });

    it('creates INTERNAL_NON_USER with optional contact', async () => {
      const dto: CreateThirdPartyDto = {
        type: ThirdPartyType.INTERNAL_NON_USER,
        organizationName: 'Service X - agent Y',
      };
      mockPrismaService.thirdParty.create.mockResolvedValue({
        id: 'tp-2',
        ...dto,
      });
      await service.create(dto, 'user-1');
      expect(mockPrismaService.thirdParty.create).toHaveBeenCalled();
    });

    it('creates LEGAL_ENTITY without contact names', async () => {
      const dto: CreateThirdPartyDto = {
        type: ThirdPartyType.LEGAL_ENTITY,
        organizationName: 'SAS ACME',
        contactEmail: 'contact@acme.fr',
      };
      mockPrismaService.thirdParty.create.mockResolvedValue({
        id: 'tp-3',
        ...dto,
      });
      await service.create(dto, 'user-1');
      expect(mockPrismaService.thirdParty.create).toHaveBeenCalled();
    });

    it('rejects LEGAL_ENTITY with contactFirstName', async () => {
      const dto: CreateThirdPartyDto = {
        type: ThirdPartyType.LEGAL_ENTITY,
        organizationName: 'SAS ACME',
        contactFirstName: 'John',
      };
      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.thirdParty.create).not.toHaveBeenCalled();
    });

    it('rejects LEGAL_ENTITY with contactLastName', async () => {
      const dto: CreateThirdPartyDto = {
        type: ThirdPartyType.LEGAL_ENTITY,
        organizationName: 'SAS ACME',
        contactLastName: 'Doe',
      };
      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('returns third party when found', async () => {
      mockPrismaService.thirdParty.findUnique.mockResolvedValue({ id: 'tp-1' });
      const result = await service.findOne('tp-1');
      expect(result).toEqual({ id: 'tp-1' });
    });

    it('throws NotFoundException when not found', async () => {
      mockPrismaService.thirdParty.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('rejects LEGAL_ENTITY type mutation that adds contactFirstName', async () => {
      mockPrismaService.thirdParty.findUnique.mockResolvedValue({
        id: 'tp-1',
        type: ThirdPartyType.EXTERNAL_PROVIDER,
        contactFirstName: null,
        contactLastName: null,
      });
      await expect(
        service.update('tp-1', {
          type: ThirdPartyType.LEGAL_ENTITY,
          contactFirstName: 'Alice',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts isActive toggle without touching contact', async () => {
      mockPrismaService.thirdParty.findUnique.mockResolvedValue({
        id: 'tp-1',
        type: ThirdPartyType.LEGAL_ENTITY,
        contactFirstName: null,
        contactLastName: null,
      });
      mockPrismaService.thirdParty.update.mockResolvedValue({
        id: 'tp-1',
        isActive: false,
      });
      await service.update('tp-1', { isActive: false });
      expect(mockPrismaService.thirdParty.update).toHaveBeenCalled();
    });

    it('throws NotFoundException when id missing', async () => {
      mockPrismaService.thirdParty.findUnique.mockResolvedValue(null);
      await expect(
        service.update('missing', { organizationName: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDeletionImpact', () => {
    it('returns counts for all three cascaded relations', async () => {
      mockPrismaService.thirdParty.findUnique.mockResolvedValue({ id: 'tp-1' });
      mockPrismaService.timeEntry.count.mockResolvedValue(5);
      mockPrismaService.taskThirdPartyAssignee.count.mockResolvedValue(2);
      mockPrismaService.projectThirdPartyMember.count.mockResolvedValue(1);

      const impact = await service.getDeletionImpact('tp-1');
      expect(impact).toEqual({
        timeEntriesCount: 5,
        taskAssignmentsCount: 2,
        projectMembershipsCount: 1,
      });
    });

    it('throws NotFoundException when third party missing', async () => {
      mockPrismaService.thirdParty.findUnique.mockResolvedValue(null);
      await expect(service.getDeletionImpact('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('filters dismissed time entries from pre-delete count (D3)', async () => {
      mockPrismaService.thirdParty.findUnique.mockResolvedValue({ id: 'tp-1' });
      mockPrismaService.timeEntry.count.mockResolvedValue(0);
      mockPrismaService.taskThirdPartyAssignee.count.mockResolvedValue(0);
      mockPrismaService.projectThirdPartyMember.count.mockResolvedValue(0);

      await service.getDeletionImpact('tp-1');

      expect(mockPrismaService.timeEntry.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            thirdPartyId: 'tp-1',
            isDismissal: false,
          }),
        }),
      );
    });
  });

  describe('findAll / findOne _count filter (D3)', () => {
    it('findAll filters dismissed time entries from _count.timeEntries', async () => {
      mockPrismaService.thirdParty.findMany.mockResolvedValue([]);
      mockPrismaService.thirdParty.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrismaService.thirdParty.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            _count: {
              select: expect.objectContaining({
                timeEntries: { where: { isDismissal: false } },
              }),
            },
          }),
        }),
      );
    });

    it('findOne filters dismissed time entries from _count.timeEntries', async () => {
      mockPrismaService.thirdParty.findUnique.mockResolvedValue({ id: 'tp-1' });

      await service.findOne('tp-1');

      expect(mockPrismaService.thirdParty.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            _count: {
              select: expect.objectContaining({
                timeEntries: { where: { isDismissal: false } },
              }),
            },
          }),
        }),
      );
    });
  });

  describe('hardDelete', () => {
    it('deletes and relies on FK cascade', async () => {
      mockPrismaService.thirdParty.findUnique.mockResolvedValue({ id: 'tp-1' });
      mockPrismaService.thirdParty.delete.mockResolvedValue({ id: 'tp-1' });
      await service.hardDelete('tp-1');
      expect(mockPrismaService.thirdParty.delete).toHaveBeenCalledWith({
        where: { id: 'tp-1' },
      });
    });

    it('throws NotFoundException when id missing', async () => {
      mockPrismaService.thirdParty.findUnique.mockResolvedValue(null);
      await expect(service.hardDelete('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assertExistsAndActive', () => {
    it('passes when active', async () => {
      mockPrismaService.thirdParty.findUnique.mockResolvedValue({
        id: 'tp-1',
        isActive: true,
      });
      await expect(
        service.assertExistsAndActive('tp-1'),
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundException when missing', async () => {
      mockPrismaService.thirdParty.findUnique.mockResolvedValue(null);
      await expect(service.assertExistsAndActive('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when archived', async () => {
      mockPrismaService.thirdParty.findUnique.mockResolvedValue({
        id: 'tp-1',
        isActive: false,
      });
      await expect(service.assertExistsAndActive('tp-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('assertAssignedToTaskOrProject', () => {
    it('passes when tiers is directly assigned to task', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: 'task-1',
        projectId: 'proj-1',
      });
      mockPrismaService.taskThirdPartyAssignee.findUnique.mockResolvedValue({
        id: 'assign-1',
      });
      await expect(
        service.assertAssignedToTaskOrProject('tp-1', { taskId: 'task-1' }),
      ).resolves.toBeUndefined();
      expect(
        mockPrismaService.projectThirdPartyMember.findUnique,
      ).not.toHaveBeenCalled();
    });

    it('passes when tiers is attached to parent project of task', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: 'task-1',
        projectId: 'proj-1',
      });
      mockPrismaService.taskThirdPartyAssignee.findUnique.mockResolvedValue(
        null,
      );
      mockPrismaService.projectThirdPartyMember.findUnique.mockResolvedValue({
        id: 'mem-1',
      });
      await expect(
        service.assertAssignedToTaskOrProject('tp-1', { taskId: 'task-1' }),
      ).resolves.toBeUndefined();
    });

    it('passes for orphan task with direct assignment', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: 'task-1',
        projectId: null,
      });
      mockPrismaService.taskThirdPartyAssignee.findUnique.mockResolvedValue({
        id: 'assign-1',
      });
      await expect(
        service.assertAssignedToTaskOrProject('tp-1', { taskId: 'task-1' }),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException on orphan task without assignment', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: 'task-1',
        projectId: null,
      });
      mockPrismaService.taskThirdPartyAssignee.findUnique.mockResolvedValue(
        null,
      );
      await expect(
        service.assertAssignedToTaskOrProject('tp-1', { taskId: 'task-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when neither task nor parent project has tiers', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: 'task-1',
        projectId: 'proj-1',
      });
      mockPrismaService.taskThirdPartyAssignee.findUnique.mockResolvedValue(
        null,
      );
      mockPrismaService.projectThirdPartyMember.findUnique.mockResolvedValue(
        null,
      );
      await expect(
        service.assertAssignedToTaskOrProject('tp-1', { taskId: 'task-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('passes with projectId only when tiers is attached', async () => {
      mockPrismaService.projectThirdPartyMember.findUnique.mockResolvedValue({
        id: 'mem-1',
      });
      await expect(
        service.assertAssignedToTaskOrProject('tp-1', { projectId: 'proj-1' }),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException with projectId only when not attached', async () => {
      mockPrismaService.projectThirdPartyMember.findUnique.mockResolvedValue(
        null,
      );
      await expect(
        service.assertAssignedToTaskOrProject('tp-1', { projectId: 'proj-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when no context given', async () => {
      await expect(
        service.assertAssignedToTaskOrProject('tp-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when taskId given but task missing', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);
      await expect(
        service.assertAssignedToTaskOrProject('tp-1', { taskId: 'missing' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignToTask', () => {
    it('creates assignment', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({ id: 'task-1' });
      mockPrismaService.thirdParty.findUnique.mockResolvedValue({
        id: 'tp-1',
        isActive: true,
      });
      mockPrismaService.taskThirdPartyAssignee.create.mockResolvedValue({
        id: 'assign-1',
      });
      await service.assignToTask('task-1', 'tp-1', 'user-1');
      expect(
        mockPrismaService.taskThirdPartyAssignee.create,
      ).toHaveBeenCalled();
    });

    it('throws NotFoundException when task missing', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);
      await expect(
        service.assignToTask('missing', 'tp-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when tiers archived', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({ id: 'task-1' });
      mockPrismaService.thirdParty.findUnique.mockResolvedValue({
        id: 'tp-1',
        isActive: false,
      });
      await expect(
        service.assignToTask('task-1', 'tp-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('attachToProject', () => {
    it('creates membership with allocation', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      mockPrismaService.thirdParty.findUnique.mockResolvedValue({
        id: 'tp-1',
        isActive: true,
      });
      mockPrismaService.projectThirdPartyMember.create.mockResolvedValue({
        id: 'mem-1',
      });
      await service.attachToProject('proj-1', 'tp-1', 'user-1', 50);
      expect(
        mockPrismaService.projectThirdPartyMember.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'proj-1',
            thirdPartyId: 'tp-1',
            allocation: 50,
          }),
        }),
      );
    });

    it('throws NotFoundException when project missing', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);
      await expect(
        service.attachToProject('missing', 'tp-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('detachFromProject', () => {
    it('deletes membership', async () => {
      mockPrismaService.projectThirdPartyMember.findUnique.mockResolvedValue({
        id: 'mem-1',
      });
      mockPrismaService.projectThirdPartyMember.delete.mockResolvedValue({
        id: 'mem-1',
      });
      await service.detachFromProject('proj-1', 'tp-1');
      expect(
        mockPrismaService.projectThirdPartyMember.delete,
      ).toHaveBeenCalled();
    });

    it('throws NotFoundException when not attached', async () => {
      mockPrismaService.projectThirdPartyMember.findUnique.mockResolvedValue(
        null,
      );
      await expect(service.detachFromProject('proj-1', 'tp-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unassignFromTask', () => {
    it('deletes assignment', async () => {
      mockPrismaService.taskThirdPartyAssignee.findUnique.mockResolvedValue({
        id: 'assign-1',
      });
      mockPrismaService.taskThirdPartyAssignee.delete.mockResolvedValue({
        id: 'assign-1',
      });
      await service.unassignFromTask('task-1', 'tp-1');
      expect(
        mockPrismaService.taskThirdPartyAssignee.delete,
      ).toHaveBeenCalled();
    });

    it('throws NotFoundException when not assigned', async () => {
      mockPrismaService.taskThirdPartyAssignee.findUnique.mockResolvedValue(
        null,
      );
      await expect(service.unassignFromTask('task-1', 'tp-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('SEC-025 — listTaskAssignees enforces task-scope access check (IDOR)', () => {
    it('SEC-025 — calls assertCanReadTask before returning assignees', async () => {
      mockPrismaService.taskThirdPartyAssignee.findMany.mockResolvedValue([
        { id: 'a-1', thirdParty: { id: 'tp-1' }, assignedBy: { id: 'u-1' } },
      ]);
      const user = { id: 'user-1', role: 'CONTRIBUTEUR' };
      await service.listTaskAssignees('task-1', user);
      expect(mockAccessScope.assertCanReadTask).toHaveBeenCalledWith(
        'task-1',
        user,
      );
    });

    it('SEC-025 — propagates ForbiddenException from assertCanReadTask', async () => {
      mockAccessScope.assertCanReadTask.mockRejectedValueOnce(
        new ForbiddenException('Accès tâche non autorisé'),
      );
      await expect(
        service.listTaskAssignees('task-1', { id: 'non-member', role: null }),
      ).rejects.toThrow(ForbiddenException);
      expect(
        mockPrismaService.taskThirdPartyAssignee.findMany,
      ).not.toHaveBeenCalled();
    });
  });

  describe('SEC-026 — listProjectMembers enforces project-scope access check (IDOR)', () => {
    it('SEC-026 — calls assertCanAccessProject before returning members', async () => {
      mockPrismaService.projectThirdPartyMember.findMany.mockResolvedValue([]);
      const user = { id: 'user-1', role: 'CONTRIBUTEUR' };
      await service.listProjectMembers('proj-1', user);
      expect(mockAccessScope.assertCanAccessProject).toHaveBeenCalledWith(
        'proj-1',
        user,
      );
    });

    it('SEC-026 — propagates ForbiddenException from assertCanAccessProject', async () => {
      mockAccessScope.assertCanAccessProject.mockRejectedValueOnce(
        new ForbiddenException('Accès projet non autorisé'),
      );
      await expect(
        service.listProjectMembers('proj-1', {
          id: 'non-member',
          role: null,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(
        mockPrismaService.projectThirdPartyMember.findMany,
      ).not.toHaveBeenCalled();
    });
  });

  describe('COR-036 — update wraps invariant check in a serializable transaction', () => {
    it('COR-036 — wraps findUnique + invariant check + update inside $transaction', async () => {
      // The mock $transaction passes the tx callback to the inner mock prisma.
      // We assert that prisma.thirdParty.findUnique is called inside the tx.
      mockPrismaService.thirdParty.findUnique.mockResolvedValue({
        id: 'tp-1',
        type: ThirdPartyType.LEGAL_ENTITY,
        contactFirstName: null,
        contactLastName: null,
      });
      mockPrismaService.thirdParty.update.mockResolvedValue({
        id: 'tp-1',
        isActive: false,
      });

      await service.update('tp-1', { isActive: false });

      expect(mockPrismaService.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'Serializable' }),
      );
    });

    it('COR-036 — throws ConflictException when Prisma P2034 (serialization failure) occurs', async () => {
      const serializationError = new Prisma.PrismaClientKnownRequestError(
        'Transaction failed due to a write conflict or a deadlock',
        { code: 'P2034', clientVersion: '6.0.0', meta: {} },
      );
      mockPrismaService.$transaction.mockRejectedValueOnce(serializationError);

      await expect(
        service.update('tp-1', { organizationName: 'X' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
