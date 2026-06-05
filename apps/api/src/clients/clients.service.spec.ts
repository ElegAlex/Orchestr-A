import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from 'database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessScopeService } from '../common/services/access-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  let service: ClientsService;

  const mockPrismaService = {
    client: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    projectClient: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    timeEntry: {
      groupBy: vi.fn(),
    },
    $transaction: vi.fn(async (queries: unknown) => {
      if (Array.isArray(queries)) return Promise.all(queries);
      return (queries as (tx: typeof mockPrismaService) => unknown)(
        mockPrismaService,
      );
    }),
  };

  const mockAccessScope = {
    assertCanAccessProject: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAccessScope.assertCanAccessProject.mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AccessScopeService, useValue: mockAccessScope },
      ],
    }).compile();
    service = module.get<ClientsService>(ClientsService);
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a client with the given name', async () => {
      mockPrismaService.client.create.mockResolvedValue({
        id: 'c-1',
        name: 'Mairie de Lyon',
        isActive: true,
      });
      const result = await service.create({ name: 'Mairie de Lyon' });
      expect(result.id).toBe('c-1');
      expect(mockPrismaService.client.create).toHaveBeenCalledWith({
        data: { name: 'Mairie de Lyon' },
      });
    });

    // COR-034: ClientsService has no findFirst pre-check (unlike Dept/Service).
    // The DAT-036 clients_name_key UNIQUE surfaces P2002 directly on the second
    // create with an identical name — wrapper maps it to 409 instead of 500.
    it('maps Prisma P2002 from create() to ConflictException (COR-034)', async () => {
      mockPrismaService.client.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`name`)',
          { code: 'P2002', clientVersion: 'test', meta: { target: ['name'] } },
        ),
      );

      const { ConflictException } = await import('@nestjs/common');
      await expect(
        service.create({ name: 'Mairie de Lyon' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated data with meta', async () => {
      mockPrismaService.client.findMany.mockResolvedValue([{ id: 'c-1' }]);
      mockPrismaService.client.count.mockResolvedValue(1);
      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('filters by isActive', async () => {
      mockPrismaService.client.findMany.mockResolvedValue([]);
      mockPrismaService.client.count.mockResolvedValue(0);
      await service.findAll({ isActive: false });
      expect(mockPrismaService.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('filters by search term (ilike)', async () => {
      mockPrismaService.client.findMany.mockResolvedValue([]);
      mockPrismaService.client.count.mockResolvedValue(0);
      await service.findAll({ search: 'Lyon' });
      expect(mockPrismaService.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'Lyon', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('defaults page=1 limit=20', async () => {
      mockPrismaService.client.findMany.mockResolvedValue([]);
      mockPrismaService.client.count.mockResolvedValue(0);
      await service.findAll({});
      expect(mockPrismaService.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the client when found', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue({
        id: 'c-1',
        name: 'X',
      });
      const result = await service.findOne('c-1');
      expect(result).toEqual({ id: 'c-1', name: 'X' });
    });

    it('throws NotFoundException when missing', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getClientProjects ─────────────────────────────────────────────────────

  describe('getClientProjects', () => {
    it('throws NotFoundException when client missing', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue(null);
      await expect(service.getClientProjects('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns empty result when client has no projects', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue({ id: 'c-1' });
      mockPrismaService.projectClient.findMany.mockResolvedValue([]);
      const result = await service.getClientProjects('c-1');
      expect(result.projects).toHaveLength(0);
      expect(result.summary.projectsTotal).toBe(0);
      expect(result.summary.varianceHours).toBe(0);
    });

    it('builds project rows with correct hoursLogged from groupBy', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue({ id: 'c-1' });
      mockPrismaService.projectClient.findMany.mockResolvedValue([
        { projectId: 'p-1' },
        { projectId: 'p-2' },
      ]);
      mockPrismaService.project.findMany.mockResolvedValue([
        {
          id: 'p-1',
          name: 'Projet A',
          status: 'ACTIVE',
          startDate: null,
          endDate: null,
          budgetHours: 100,
          manager: { id: 'u-1', firstName: 'Alice', lastName: 'B' },
        },
        {
          id: 'p-2',
          name: 'Projet B',
          status: 'DRAFT',
          startDate: null,
          endDate: null,
          budgetHours: null,
          manager: null,
        },
      ]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([
        { projectId: 'p-1', _sum: { hours: 40 } },
      ]);

      const result = await service.getClientProjects('c-1');
      expect(result.projects).toHaveLength(2);

      const projA = result.projects.find((p) => p.id === 'p-1')!;
      expect(projA.hoursLogged).toBe(40);
      expect(projA.budgetHours).toBe(100);

      const projB = result.projects.find((p) => p.id === 'p-2')!;
      expect(projB.hoursLogged).toBe(0);
      expect(projB.budgetHours).toBeNull();

      expect(result.summary.projectsActive).toBe(1);
      expect(result.summary.projectsTotal).toBe(2);
      expect(result.summary.budgetHoursTotal).toBe(100); // p-2 null coerced to 0
      expect(result.summary.hoursLoggedTotal).toBe(40);
      expect(result.summary.varianceHours).toBe(60);
    });

    it('calls groupBy with the correct projectIds', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue({ id: 'c-1' });
      mockPrismaService.projectClient.findMany.mockResolvedValue([
        { projectId: 'p-1' },
      ]);
      mockPrismaService.project.findMany.mockResolvedValue([
        {
          id: 'p-1',
          name: 'Projet A',
          status: 'ACTIVE',
          startDate: null,
          endDate: null,
          budgetHours: null,
          manager: null,
        },
      ]);
      mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

      await service.getClientProjects('c-1');
      expect(mockPrismaService.timeEntry.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: { in: ['p-1'] } },
        }),
      );
    });
  });

  // ─── getDeletionImpact ─────────────────────────────────────────────────────

  describe('getDeletionImpact', () => {
    it('returns the number of linked projects', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue({ id: 'c-1' });
      mockPrismaService.projectClient.count.mockResolvedValue(3);
      const result = await service.getDeletionImpact('c-1');
      expect(result).toEqual({ projectsCount: 3 });
    });

    it('throws NotFoundException when client missing', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue(null);
      await expect(service.getDeletionImpact('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates the client fields', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue({ id: 'c-1' });
      mockPrismaService.client.update.mockResolvedValue({
        id: 'c-1',
        name: 'New',
        isActive: false,
      });
      const result = await service.update('c-1', {
        name: 'New',
        isActive: false,
      });
      expect(result.name).toBe('New');
      expect(mockPrismaService.client.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'c-1' } }),
      );
    });

    it('throws NotFoundException when client missing', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    // COR-034: rename collides with a concurrent peer that grabbed the new name first.
    it('maps Prisma P2002 from update() to ConflictException (COR-034)', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue({
        id: 'c-1',
        name: 'Old',
      });
      mockPrismaService.client.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`name`)',
          { code: 'P2002', clientVersion: 'test', meta: { target: ['name'] } },
        ),
      );

      const { ConflictException } = await import('@nestjs/common');
      await expect(
        service.update('c-1', { name: 'TakenName' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ─── hardDelete ───────────────────────────────────────────────────────────

  describe('hardDelete', () => {
    it('deletes when no projects are linked', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue({ id: 'c-1' });
      mockPrismaService.projectClient.count.mockResolvedValue(0);
      mockPrismaService.client.delete.mockResolvedValue({ id: 'c-1' });
      await service.hardDelete('c-1');
      expect(mockPrismaService.client.delete).toHaveBeenCalledWith({
        where: { id: 'c-1' },
      });
    });

    it('throws ConflictException when projects are linked', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue({ id: 'c-1' });
      mockPrismaService.projectClient.count.mockResolvedValue(2);
      await expect(service.hardDelete('c-1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.client.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when client missing', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue(null);
      await expect(service.hardDelete('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('COR-008 — count-check and delete execute inside a single $transaction', async () => {
      // Both the guard (count) and the destructive op (delete) must be wrapped in
      // a single $transaction so a concurrent assignClientToProject cannot insert
      // a ProjectClient row between the count read and the DELETE (TOCTOU fix).
      mockPrismaService.client.findUnique.mockResolvedValue({ id: 'c-1' });
      mockPrismaService.projectClient.count.mockResolvedValue(0);
      mockPrismaService.client.delete.mockResolvedValue({ id: 'c-1' });

      await service.hardDelete('c-1');

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      // count + delete still reached via the tx callback (mockPrismaService acts as tx)
      expect(mockPrismaService.projectClient.count).toHaveBeenCalledWith({
        where: { clientId: 'c-1' },
      });
      expect(mockPrismaService.client.delete).toHaveBeenCalledWith({
        where: { id: 'c-1' },
      });
    });
  });

  // ─── assertExistsAndActive ─────────────────────────────────────────────────

  describe('assertExistsAndActive', () => {
    it('passes when client is active', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue({
        id: 'c-1',
        isActive: true,
      });
      await expect(
        service.assertExistsAndActive('c-1'),
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundException when client missing', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue(null);
      await expect(service.assertExistsAndActive('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when client is archived', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue({
        id: 'c-1',
        isActive: false,
      });
      await expect(service.assertExistsAndActive('c-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── listProjectClients ────────────────────────────────────────────────────

  describe('listProjectClients', () => {
    const memberUser = {
      id: 'u-1',
      role: { code: 'CONTRIBUTEUR', templateKey: 'CONTRIBUTEUR' },
    };

    it('returns project clients ordered by createdAt', async () => {
      mockPrismaService.projectClient.findMany.mockResolvedValue([
        { projectId: 'p-1', clientId: 'c-1', client: { id: 'c-1', name: 'X' } },
      ]);
      const result = await service.listProjectClients('p-1', memberUser);
      expect(result).toHaveLength(1);
      expect(mockPrismaService.projectClient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'p-1' },
          orderBy: { createdAt: 'asc' },
        }),
      );
    });

    it('SEC-004 — non-member user receives ForbiddenException', async () => {
      // assertCanAccessProject throws ForbiddenException for users without
      // project membership and without projects:manage_any permission.
      mockAccessScope.assertCanAccessProject.mockRejectedValueOnce(
        new ForbiddenException('Accès projet non autorisé'),
      );
      const nonMember = {
        id: 'u-99',
        role: { code: 'OBSERVATEUR', templateKey: 'OBSERVATEUR' },
      };

      await expect(
        service.listProjectClients('p-other', nonMember),
      ).rejects.toBeInstanceOf(ForbiddenException);

      // The DB query must NOT be reached.
      expect(mockPrismaService.projectClient.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── assignClientToProject ─────────────────────────────────────────────────

  describe('assignClientToProject', () => {
    it('creates a project-client link', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrismaService.client.findUnique.mockResolvedValue({
        id: 'c-1',
        isActive: true,
      });
      mockPrismaService.projectClient.create.mockResolvedValue({
        projectId: 'p-1',
        clientId: 'c-1',
        client: { id: 'c-1' },
      });
      const result = await service.assignClientToProject('p-1', 'c-1');
      expect(result).toBeDefined();
      expect(mockPrismaService.projectClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { projectId: 'p-1', clientId: 'c-1' },
        }),
      );
    });

    it('throws NotFoundException when project missing', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);
      await expect(
        service.assignClientToProject('missing', 'c-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when client is archived', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrismaService.client.findUnique.mockResolvedValue({
        id: 'c-1',
        isActive: false,
      });
      await expect(service.assignClientToProject('p-1', 'c-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException on duplicate (P2002)', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'p-1' });
      mockPrismaService.client.findUnique.mockResolvedValue({
        id: 'c-1',
        isActive: true,
      });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: '6.0.0',
      });
      mockPrismaService.projectClient.create.mockRejectedValue(p2002);
      await expect(service.assignClientToProject('p-1', 'c-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── removeClientFromProject ───────────────────────────────────────────────

  describe('removeClientFromProject', () => {
    it('removes the project-client link', async () => {
      mockPrismaService.projectClient.findUnique.mockResolvedValue({
        projectId: 'p-1',
        clientId: 'c-1',
      });
      mockPrismaService.projectClient.delete.mockResolvedValue({});
      await service.removeClientFromProject('p-1', 'c-1');
      expect(mockPrismaService.projectClient.delete).toHaveBeenCalled();
    });

    it('throws NotFoundException when link missing', async () => {
      mockPrismaService.projectClient.findUnique.mockResolvedValue(null);
      await expect(
        service.removeClientFromProject('p-1', 'c-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
