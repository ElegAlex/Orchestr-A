import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CommentsService', () => {
  let service: CommentsService;

  const mockPrismaService = {
    comment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
  });

  describe('findAll', () => {
    it('should return comments for a task', async () => {
      const mockComments = [
        { id: '1', content: 'Comment 1', taskId: 'task-1' },
        { id: '2', content: 'Comment 2', taskId: 'task-1' },
      ];

      mockPrismaService.comment.findMany.mockResolvedValue(mockComments);

      const result = await service.findAll({ taskId: 'task-1' });

      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update a comment successfully', async () => {
      const updateDto = { content: 'Updated comment' };
      const existing = { id: '1', content: 'Old', userId: 'user-1' };
      const updated = { ...existing, ...updateDto };

      mockPrismaService.comment.findUnique.mockResolvedValue(existing);
      mockPrismaService.comment.update.mockResolvedValue(updated);

      const result = await service.update('1', updateDto);

      expect(result.content).toBe('Updated comment');
    });
  });

  describe('remove', () => {
    it('should delete a comment', async () => {
      const mockComment = { id: '1', content: 'Comment' };

      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      mockPrismaService.comment.delete.mockResolvedValue(mockComment);

      await service.remove('1');

      expect(mockPrismaService.comment.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
