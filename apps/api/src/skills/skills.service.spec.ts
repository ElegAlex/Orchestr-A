import { Test, TestingModule } from '@nestjs/testing';
import { SkillsService } from './skills.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('SkillsService', () => {
  let service: SkillsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    skill: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    userSkill: {
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  const mockSkill = {
    id: 'skill-1',
    name: 'TypeScript',
    category: 'Programming',
    description: 'TypeScript programming language',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a skill successfully', async () => {
      const createDto = {
        name: 'TypeScript',
        category: 'Programming',
        description: 'TypeScript programming language',
      };

      mockPrismaService.skill.create.mockResolvedValue(mockSkill);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createDto.name);
      expect(mockPrismaService.skill.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated skills', async () => {
      const mockSkills = [mockSkill];
      mockPrismaService.skill.findMany.mockResolvedValue(mockSkills);
      mockPrismaService.skill.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter skills by category', async () => {
      mockPrismaService.skill.findMany.mockResolvedValue([mockSkill]);
      mockPrismaService.skill.count.mockResolvedValue(1);

      await service.findAll({ category: 'Programming' });

      expect(mockPrismaService.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'Programming' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a skill by id', async () => {
      mockPrismaService.skill.findUnique.mockResolvedValue(mockSkill);

      const result = await service.findOne('skill-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('skill-1');
    });

    it('should throw error when skill not found', async () => {
      mockPrismaService.skill.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignToUser', () => {
    it('should assign a skill to a user successfully', async () => {
      const assignDto = {
        userId: 'user-1',
        skillId: 'skill-1',
        level: 'INTERMEDIATE' as const,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.skill.findUnique.mockResolvedValue(mockSkill);
      mockPrismaService.userSkill.create.mockResolvedValue({
        userId: 'user-1',
        skillId: 'skill-1',
        level: 'INTERMEDIATE',
        assignedAt: new Date(),
      });

      const result = await service.assignToUser(assignDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.userSkill.create).toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      const assignDto = {
        userId: 'nonexistent',
        skillId: 'skill-1',
        level: 'INTERMEDIATE' as const,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.assignToUser(assignDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a skill successfully', async () => {
      const updateDto = { name: 'Updated TypeScript' };
      mockPrismaService.skill.findUnique.mockResolvedValue(mockSkill);
      mockPrismaService.skill.update.mockResolvedValue({
        ...mockSkill,
        ...updateDto,
      });

      const result = await service.update('skill-1', updateDto);

      expect(result.name).toBe('Updated TypeScript');
    });
  });

  describe('remove', () => {
    it('should delete a skill', async () => {
      mockPrismaService.skill.findUnique.mockResolvedValue(mockSkill);
      mockPrismaService.skill.delete.mockResolvedValue(mockSkill);

      await service.remove('skill-1');

      expect(mockPrismaService.skill.delete).toHaveBeenCalledWith({
        where: { id: 'skill-1' },
      });
    });
  });
});
