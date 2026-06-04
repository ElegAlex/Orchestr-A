import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PersonalTodosService } from './personal-todos.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PersonalTodosService', () => {
  let service: PersonalTodosService;

  const mockPrismaService = {
    personalTodo: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  };

  const userId = 'user-1';

  const makeTodo = (overrides = {}) => ({
    id: 'todo-1',
    userId,
    text: 'Buy milk',
    completed: false,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalTodosService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PersonalTodosService>(PersonalTodosService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create — MAX_TODOS cap', () => {
    it('should throw BadRequestException when 20 todos already exist', async () => {
      mockPrismaService.personalTodo.count.mockResolvedValue(20);

      await expect(
        service.create(userId, { text: 'todo 21' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should include the limit in the error message', async () => {
      mockPrismaService.personalTodo.count.mockResolvedValue(20);

      await expect(
        service.create(userId, { text: 'overflow' }),
      ).rejects.toThrow('20');
    });

    it('should create a todo when count is below the limit', async () => {
      mockPrismaService.personalTodo.count.mockResolvedValue(5);
      const todo = makeTodo();
      mockPrismaService.personalTodo.create.mockResolvedValue(todo);

      const result = await service.create(userId, { text: 'Buy milk' });

      expect(result).toBeDefined();
      expect(result.text).toBe('Buy milk');
    });

    it('should allow exactly 19 todos (boundary)', async () => {
      mockPrismaService.personalTodo.count.mockResolvedValue(19);
      const todo = makeTodo({ text: 'todo 20' });
      mockPrismaService.personalTodo.create.mockResolvedValue(todo);

      await expect(
        service.create(userId, { text: 'todo 20' }),
      ).resolves.toBeDefined();
    });
  });

  describe('findByUser', () => {
    it('should return todos ordered by completed, then createdAt desc', async () => {
      const todos = [makeTodo(), makeTodo({ id: 'todo-2', completed: true })];
      mockPrismaService.personalTodo.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.personalTodo.findMany.mockResolvedValue(todos);

      const result = await service.findByUser(userId);

      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update todo text', async () => {
      const existing = makeTodo();
      const updated = makeTodo({ text: 'Updated text' });
      mockPrismaService.personalTodo.findUnique.mockResolvedValue(existing);
      mockPrismaService.personalTodo.update.mockResolvedValue(updated);

      const result = await service.update('todo-1', userId, {
        text: 'Updated text',
      });

      expect(result.text).toBe('Updated text');
    });

    it('should throw NotFoundException for unknown todo id', async () => {
      mockPrismaService.personalTodo.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', userId, { text: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw ForbiddenException when userId does not match', async () => {
      const existing = makeTodo({ userId: 'other-user' });
      mockPrismaService.personalTodo.findUnique.mockResolvedValue(existing);

      await expect(
        service.update('todo-1', userId, { text: 'x' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should set completedAt when marking complete', async () => {
      const existing = makeTodo();
      const now = new Date();
      const updated = makeTodo({ completed: true, completedAt: now });
      mockPrismaService.personalTodo.findUnique.mockResolvedValue(existing);
      mockPrismaService.personalTodo.update.mockResolvedValue(updated);

      const result = await service.update('todo-1', userId, {
        completed: true,
      });

      expect(result.completed).toBe(true);
      expect(result.completedAt).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete an owned todo', async () => {
      const existing = makeTodo();
      mockPrismaService.personalTodo.findUnique.mockResolvedValue(existing);
      mockPrismaService.personalTodo.delete.mockResolvedValue(existing);

      await expect(service.delete('todo-1', userId)).resolves.toBeUndefined();
    });

    it('should throw NotFoundException for unknown todo', async () => {
      mockPrismaService.personalTodo.findUnique.mockResolvedValue(null);

      await expect(service.delete('ghost', userId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when owner mismatch', async () => {
      mockPrismaService.personalTodo.findUnique.mockResolvedValue(
        makeTodo({ userId: 'alien' }),
      );

      await expect(service.delete('todo-1', userId)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
