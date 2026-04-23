import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { OwnershipService } from './ownership.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('OwnershipService', () => {
  let service: OwnershipService;

  const mockPrismaService = {
    leave: {
      findUnique: vi.fn(),
    },
    teleworkSchedule: {
      findUnique: vi.fn(),
    },
    timeEntry: {
      findUnique: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    projectMember: {
      findFirst: vi.fn(),
    },
    event: {
      findUnique: vi.fn(),
    },
    document: {
      findUnique: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnershipService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OwnershipService>(OwnershipService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isOwner - guard clauses', () => {
    it('should return false when resourceId is falsy', async () => {
      const result = await service.isOwner('leave', '', 'user-1');
      expect(result).toBe(false);
      expect(mockPrismaService.leave.findUnique).not.toHaveBeenCalled();
    });

    it('should return false when userId is falsy', async () => {
      const result = await service.isOwner('leave', 'leave-1', '');
      expect(result).toBe(false);
      expect(mockPrismaService.leave.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('isOwner - leave', () => {
    it('should return true when user owns the leave', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue({
        userId: 'user-1',
      });

      const result = await service.isOwner('leave', 'leave-1', 'user-1');

      expect(result).toBe(true);
      expect(mockPrismaService.leave.findUnique).toHaveBeenCalledWith({
        where: { id: 'leave-1' },
        select: { userId: true },
      });
    });

    it('should return false when user does not own the leave', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue({
        userId: 'user-2',
      });

      const result = await service.isOwner('leave', 'leave-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false when leave does not exist', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(null);

      const result = await service.isOwner('leave', 'nonexistent', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('isOwner - telework', () => {
    it('should return true when user owns the telework schedule', async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue({
        userId: 'user-1',
      });

      const result = await service.isOwner('telework', 'telework-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when telework schedule not found', async () => {
      mockPrismaService.teleworkSchedule.findUnique.mockResolvedValue(null);

      const result = await service.isOwner('telework', 'telework-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('isOwner - timeEntry', () => {
    it('should return true when userId matches', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({
        userId: 'user-1',
        declaredById: 'other-user',
      });

      const result = await service.isOwner('timeEntry', 'entry-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return true when declaredById matches', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({
        userId: null,
        declaredById: 'user-1',
      });

      const result = await service.isOwner('timeEntry', 'entry-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when neither userId nor declaredById matches', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue({
        userId: 'other-user',
        declaredById: 'another-user',
      });

      const result = await service.isOwner('timeEntry', 'entry-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false when time entry not found', async () => {
      mockPrismaService.timeEntry.findUnique.mockResolvedValue(null);

      const result = await service.isOwner('timeEntry', 'entry-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('isOwner - project', () => {
    it('should return true when user is the creator', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        createdById: 'user-1',
        managerId: null,
        sponsorId: null,
      });

      const result = await service.isOwner('project', 'project-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return true when user is the manager', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        createdById: 'other-user',
        managerId: 'user-1',
        sponsorId: null,
      });

      const result = await service.isOwner('project', 'project-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return true when user is the sponsor', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        createdById: 'other-user',
        managerId: null,
        sponsorId: 'user-1',
      });

      const result = await service.isOwner('project', 'project-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return true when user is a leader member', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        createdById: 'other-user',
        managerId: null,
        sponsorId: null,
      });
      mockPrismaService.projectMember.findFirst.mockResolvedValue({
        id: 'member-1',
      });

      const result = await service.isOwner('project', 'project-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when user is not a project leader', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        createdById: 'other-user',
        managerId: null,
        sponsorId: null,
      });
      mockPrismaService.projectMember.findFirst.mockResolvedValue(null);

      const result = await service.isOwner('project', 'project-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      const result = await service.isOwner('project', 'nonexistent', 'user-1');

      expect(result).toBe(false);
      expect(mockPrismaService.projectMember.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('isOwner - event', () => {
    it('should return true when user created the event', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({
        createdById: 'user-1',
      });

      const result = await service.isOwner('event', 'event-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when user did not create the event', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({
        createdById: 'other-user',
      });

      const result = await service.isOwner('event', 'event-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false when event not found', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      const result = await service.isOwner('event', 'event-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('isOwner - document', () => {
    it('should return true when user uploaded the document', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue({
        uploadedBy: 'user-1',
      });

      const result = await service.isOwner('document', 'doc-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when user did not upload the document', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue({
        uploadedBy: 'other-user',
      });

      const result = await service.isOwner('document', 'doc-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false when document not found', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(null);

      const result = await service.isOwner('document', 'doc-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('isOwner - default/unknown resource', () => {
    it('should return false for unknown resource type', async () => {
      const result = await service.isOwner(
        'unknownResource' as any,
        'resource-1',
        'user-1',
      );

      expect(result).toBe(false);
    });
  });
});
