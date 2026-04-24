import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditPersistenceService } from './audit-persistence.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditPersistenceService', () => {
  let service: AuditPersistenceService;

  const mockPrismaService = {
    auditLog: {
      create: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditPersistenceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditPersistenceService>(AuditPersistenceService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('log', () => {
    it('1. devrait appeler prisma.auditLog.create avec les bons args (événement complet)', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.log({
        action: 'ASSIGNMENT_STATUS_CHANGED',
        entityType: 'PredefinedTaskAssignment',
        entityId: 'assignment-1',
        actorId: 'user-1',
        payload: { before: 'NOT_DONE', after: 'DONE', reason: null },
      });

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'ASSIGNMENT_STATUS_CHANGED',
          entityType: 'PredefinedTaskAssignment',
          entityId: 'assignment-1',
          actorId: 'user-1',
          payload: { before: 'NOT_DONE', after: 'DONE', reason: null },
        },
      });
    });

    it('2. devrait persister actorId: null quand actorId est absent', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'log-2' });

      await service.log({
        action: 'ASSIGNMENT_STATUS_CHANGED',
        entityType: 'PredefinedTaskAssignment',
        entityId: 'assignment-2',
      });

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'ASSIGNMENT_STATUS_CHANGED',
          entityType: 'PredefinedTaskAssignment',
          entityId: 'assignment-2',
          actorId: null,
          payload: undefined,
        },
      });
    });

    it('3. devrait persister payload: undefined quand payload est absent (pas de crash)', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'log-3' });

      await expect(
        service.log({
          action: 'ASSIGNMENT_STATUS_CHANGED',
          entityType: 'PredefinedTaskAssignment',
          entityId: 'assignment-3',
          actorId: 'user-1',
        }),
      ).resolves.not.toThrow();

      const callArg = mockPrismaService.auditLog.create.mock.calls[0][0];
      expect(callArg.data.payload).toBeUndefined();
    });
  });
});
