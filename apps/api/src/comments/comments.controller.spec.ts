import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('CommentsController', () => {
  let controller: CommentsController;
  let commentsService: CommentsService;

  const mockComment = {
    id: 'comment-id-1',
    content: 'This is a test comment',
    taskId: 'task-id-1',
    authorId: 'user-id-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    author: {
      id: 'user-id-1',
      firstName: 'John',
      lastName: 'Doe',
    },
    task: {
      id: 'task-id-1',
      title: 'Implement feature',
    },
  };

  const mockCommentsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        {
          provide: CommentsService,
          useValue: mockCommentsService,
        },
      ],
    }).compile();

    controller = module.get<CommentsController>(CommentsController);
    commentsService = module.get<CommentsService>(CommentsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createCommentDto = {
      content: 'This is a test comment',
      taskId: 'task-id-1',
    };

    it('should create a comment successfully', async () => {
      mockCommentsService.create.mockResolvedValue(mockComment);

      const result = await controller.create('user-id-1', createCommentDto);

      expect(result).toEqual(mockComment);
      expect(mockCommentsService.create).toHaveBeenCalledWith(
        'user-id-1',
        createCommentDto,
      );
      expect(mockCommentsService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when task not found', async () => {
      mockCommentsService.create.mockRejectedValue(
        new NotFoundException('Tâche introuvable'),
      );

      await expect(
        controller.create('user-id-1', createCommentDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated comments', async () => {
      const paginatedResult = {
        data: [mockComment],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockCommentsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockCommentsService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
      );
    });

    it('should filter by taskId', async () => {
      const taskComments = {
        data: [mockComment],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockCommentsService.findAll.mockResolvedValue(taskComments);

      await controller.findAll(1, 10, 'task-id-1');

      expect(mockCommentsService.findAll).toHaveBeenCalledWith(
        1,
        10,
        'task-id-1',
      );
    });
  });

  describe('findOne', () => {
    it('should return a comment by id', async () => {
      mockCommentsService.findOne.mockResolvedValue(mockComment);

      const result = await controller.findOne('comment-id-1');

      expect(result).toEqual(mockComment);
      expect(mockCommentsService.findOne).toHaveBeenCalledWith('comment-id-1');
    });

    it('should throw NotFoundException when comment not found', async () => {
      mockCommentsService.findOne.mockRejectedValue(
        new NotFoundException('Commentaire introuvable'),
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateCommentDto = {
      content: 'Updated comment content',
    };

    it('should update a comment successfully when user is author', async () => {
      const updatedComment = {
        ...mockComment,
        content: 'Updated comment content',
      };
      mockCommentsService.update.mockResolvedValue(updatedComment);

      const result = await controller.update(
        'comment-id-1',
        'user-id-1',
        updateCommentDto,
      );

      expect(result.content).toBe('Updated comment content');
      expect(mockCommentsService.update).toHaveBeenCalledWith(
        'comment-id-1',
        'user-id-1',
        updateCommentDto,
      );
    });

    it('should throw ForbiddenException when user is not the author', async () => {
      mockCommentsService.update.mockRejectedValue(
        new ForbiddenException(
          'Vous ne pouvez modifier que vos propres commentaires',
        ),
      );

      await expect(
        controller.update('comment-id-1', 'other-user-id', updateCommentDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when comment not found', async () => {
      mockCommentsService.update.mockRejectedValue(
        new NotFoundException('Commentaire introuvable'),
      );

      await expect(
        controller.update('nonexistent', 'user-id-1', updateCommentDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a comment when user is author', async () => {
      mockCommentsService.remove.mockResolvedValue({
        message: 'Commentaire supprimé',
      });

      const result = await controller.remove(
        'comment-id-1',
        'user-id-1',
        'CONTRIBUTEUR',
      );

      expect(result.message).toBe('Commentaire supprimé');
      expect(mockCommentsService.remove).toHaveBeenCalledWith(
        'comment-id-1',
        'user-id-1',
        'CONTRIBUTEUR',
      );
    });

    it('should delete a comment when user is admin', async () => {
      mockCommentsService.remove.mockResolvedValue({
        message: 'Commentaire supprimé',
      });

      const result = await controller.remove(
        'comment-id-1',
        'admin-id',
        'ADMIN',
      );

      expect(result.message).toBe('Commentaire supprimé');
      expect(mockCommentsService.remove).toHaveBeenCalledWith(
        'comment-id-1',
        'admin-id',
        'ADMIN',
      );
    });

    it('should throw ForbiddenException when user is not author and not admin', async () => {
      mockCommentsService.remove.mockRejectedValue(
        new ForbiddenException(
          'Vous ne pouvez supprimer que vos propres commentaires',
        ),
      );

      await expect(
        controller.remove('comment-id-1', 'other-user-id', 'CONTRIBUTEUR'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when comment not found', async () => {
      mockCommentsService.remove.mockRejectedValue(
        new NotFoundException('Commentaire introuvable'),
      );

      await expect(
        controller.remove('nonexistent', 'user-id-1', 'CONTRIBUTEUR'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
