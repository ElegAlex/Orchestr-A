import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { AccessScopeService } from '../common/services/access-scope.service';

describe('CommentsService', () => {
  let service: CommentsService;

  const mockPrismaService = {
    comment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    task: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PermissionsService,
          useValue: {
            getPermissionsForRole: vi
              .fn()
              .mockResolvedValue(['comments:delete']),
          },
        },
        {
          provide: AccessScopeService,
          useValue: {
            taskReadWhere: vi.fn().mockResolvedValue({}),
            assertCanReadTask: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const userId = 'user-1';
    const createDto = {
      content: 'This is a comment',
      taskId: 'task-1',
    };

    it('should create a comment successfully', async () => {
      const mockTask = { id: 'task-1', title: 'Task' };
      const mockUser = { id: userId, firstName: 'John' };
      const mockComment = {
        id: '1',
        content: createDto.content,
        taskId: createDto.taskId,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.comment.create.mockResolvedValue(mockComment);

      const result = await service.create(userId, createDto);

      expect(result).toBeDefined();
      expect(result.content).toBe(createDto.content);
    });

    it('should throw NotFoundException when task does not exist', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(service.create(userId, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return comments for a task', async () => {
      const mockComments = [
        { id: '1', content: 'Comment 1', taskId: 'task-1' },
        { id: '2', content: 'Comment 2', taskId: 'task-1' },
      ];

      mockPrismaService.comment.findMany.mockResolvedValue(mockComments);
      mockPrismaService.comment.count.mockResolvedValue(2);

      const result = await service.findAll(1, 10, 'task-1');

      expect(result.data).toHaveLength(2);
    });

    // PER-041: hard cap must be 100 regardless of caller-supplied limit
    it('PER-041 — caps safeLimit at 100 even when limit=500 is supplied', async () => {
      mockPrismaService.comment.findMany.mockResolvedValue([]);
      mockPrismaService.comment.count.mockResolvedValue(0);

      const result = await service.findAll(1, 500, 'task-1');

      expect(result.meta.limit).toBeLessThanOrEqual(100);
      const call = mockPrismaService.comment.findMany.mock.calls[0][0] as {
        take: number;
      };
      expect(call.take).toBeLessThanOrEqual(100);
    });
  });

  describe('update', () => {
    it('should update a comment successfully', async () => {
      const updateDto = { content: 'Updated comment' };
      const existing = { id: '1', content: 'Old', authorId: 'user-1' };
      const updated = { ...existing, ...updateDto };

      mockPrismaService.comment.findUnique.mockResolvedValue(existing);
      mockPrismaService.comment.update.mockResolvedValue(updated);

      const result = await service.update('1', 'user-1', updateDto);

      expect(result.content).toBe('Updated comment');
    });

    it('should throw NotFoundException when comment does not exist on update', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', 'user-1', { content: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when non-author tries to update', async () => {
      const existing = { id: '1', content: 'Old', authorId: 'user-1' };
      mockPrismaService.comment.findUnique.mockResolvedValue(existing);

      await expect(
        service.update('1', 'user-2', { content: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete a comment', async () => {
      const mockComment = { id: '1', content: 'Comment', authorId: 'user-1' };

      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      mockPrismaService.comment.delete.mockResolvedValue(mockComment);

      await service.remove('1', 'user-1', 'ADMIN');

      expect(mockPrismaService.comment.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundException when comment does not exist on remove', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when non-author without delete_any permission tries to remove', async () => {
      const mockComment = { id: '1', content: 'Comment', authorId: 'user-1' };
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      // Default mock returns ['comments:delete'] — no delete_any, no manage_any

      await expect(
        service.remove('1', 'user-2', {
          id: 'user-2',
          role: 'CONTRIBUTEUR',
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow remove when user has comments:delete_any permission', async () => {
      const mockComment = { id: '1', content: 'Comment', authorId: 'user-1' };
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      mockPrismaService.comment.delete.mockResolvedValue(mockComment);

      // Override permissions mock for this test
      const permissionsService = (service as any).permissionsService;
      vi.spyOn(permissionsService, 'getPermissionsForRole').mockResolvedValue([
        'comments:delete_any',
      ]);

      await expect(
        service.remove('1', 'user-2', {
          id: 'user-2',
          role: 'ADMIN',
        } as any),
      ).resolves.toEqual({ message: 'Commentaire supprimé avec succès' });

      expect(mockPrismaService.comment.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
