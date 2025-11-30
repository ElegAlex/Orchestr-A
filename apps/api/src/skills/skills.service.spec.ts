import { Test, TestingModule } from '@nestjs/testing';
import { SkillsService } from './skills.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('SkillsService', () => {
  let service: SkillsService;

  const mockPrismaService = {
    skill: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    userSkill: {
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  };

  const mockSkill = {
    id: 'skill-1',
    name: 'TypeScript',
    category: 'TECHNICAL',
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a skill successfully', async () => {
      const createDto = {
        name: 'TypeScript',
        category: 'TECHNICAL' as any,
        description: 'TypeScript programming language',
      };

      mockPrismaService.skill.findFirst.mockResolvedValue(null);
      mockPrismaService.skill.create.mockResolvedValue(mockSkill);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createDto.name);
      expect(mockPrismaService.skill.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when skill name already exists', async () => {
      const createDto = {
        name: 'TypeScript',
        category: 'TECHNICAL' as any,
      };

      mockPrismaService.skill.findFirst.mockResolvedValue(mockSkill);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated skills', async () => {
      const mockSkills = [mockSkill];
      mockPrismaService.skill.findMany.mockResolvedValue(mockSkills);
      mockPrismaService.skill.count.mockResolvedValue(1);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter skills by category', async () => {
      mockPrismaService.skill.findMany.mockResolvedValue([mockSkill]);
      mockPrismaService.skill.count.mockResolvedValue(1);

      await service.findAll(1, 10, 'TECHNICAL' as any);

      expect(mockPrismaService.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'TECHNICAL' }),
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

  describe('update', () => {
    it('should update a skill successfully', async () => {
      const updateDto = { name: 'Updated TypeScript' };
      mockPrismaService.skill.findUnique.mockResolvedValue(mockSkill);
      mockPrismaService.skill.findFirst.mockResolvedValue(null);
      mockPrismaService.skill.update.mockResolvedValue({
        ...mockSkill,
        ...updateDto,
      });

      const result = await service.update('skill-1', updateDto);

      expect(result.name).toBe('Updated TypeScript');
    });

    it('should throw error when skill not found', async () => {
      mockPrismaService.skill.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid', { name: 'Test' })).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when new name already exists', async () => {
      mockPrismaService.skill.findUnique.mockResolvedValue(mockSkill);
      mockPrismaService.skill.findFirst.mockResolvedValue({ id: 'other-skill', name: 'Existing' });

      await expect(service.update('skill-1', { name: 'Existing' })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete a skill', async () => {
      const mockSkillWithCount = {
        ...mockSkill,
        _count: { users: 0 },
      };
      mockPrismaService.skill.findUnique.mockResolvedValue(mockSkillWithCount);
      mockPrismaService.skill.delete.mockResolvedValue(mockSkillWithCount);

      await service.remove('skill-1');

      expect(mockPrismaService.skill.delete).toHaveBeenCalledWith({
        where: { id: 'skill-1' },
      });
    });

    it('should throw error when skill not found', async () => {
      mockPrismaService.skill.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid')).rejects.toThrow(NotFoundException);
    });

    it('should throw error when skill has users', async () => {
      const mockSkillWithUsers = {
        ...mockSkill,
        _count: { users: 5 },
      };
      mockPrismaService.skill.findUnique.mockResolvedValue(mockSkillWithUsers);

      await expect(service.remove('skill-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('assignSkillToUser', () => {
    it('should assign a skill to a user successfully', async () => {
      const userId = 'user-1';
      const assignDto = {
        skillId: 'skill-1',
        level: 'INTERMEDIATE' as const,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.skill.findUnique.mockResolvedValue(mockSkill);
      mockPrismaService.userSkill.findUnique.mockResolvedValue(null);
      mockPrismaService.userSkill.create.mockResolvedValue({
        userId: 'user-1',
        skillId: 'skill-1',
        level: 'INTERMEDIATE',
        assignedAt: new Date(),
      });

      const result = await service.assignSkillToUser(userId, assignDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.userSkill.create).toHaveBeenCalled();
    });

    it('should update level if skill already assigned', async () => {
      const userId = 'user-1';
      const assignDto = {
        skillId: 'skill-1',
        level: 'EXPERT' as const,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.skill.findUnique.mockResolvedValue(mockSkill);
      mockPrismaService.userSkill.findUnique.mockResolvedValue({
        userId: 'user-1',
        skillId: 'skill-1',
        level: 'INTERMEDIATE',
      });
      mockPrismaService.userSkill.update.mockResolvedValue({
        userId: 'user-1',
        skillId: 'skill-1',
        level: 'EXPERT',
      });

      const result = await service.assignSkillToUser(userId, assignDto);

      expect(result.level).toBe('EXPERT');
      expect(mockPrismaService.userSkill.update).toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      const userId = 'nonexistent';
      const assignDto = {
        skillId: 'skill-1',
        level: 'INTERMEDIATE' as const,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.assignSkillToUser(userId, assignDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw error when skill not found', async () => {
      const userId = 'user-1';
      const assignDto = {
        skillId: 'invalid',
        level: 'INTERMEDIATE' as const,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.skill.findUnique.mockResolvedValue(null);

      await expect(service.assignSkillToUser(userId, assignDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeSkillFromUser', () => {
    it('should remove skill from user successfully', async () => {
      mockPrismaService.userSkill.findUnique.mockResolvedValue({
        userId: 'user-1',
        skillId: 'skill-1',
      });
      mockPrismaService.userSkill.delete.mockResolvedValue({});

      const result = await service.removeSkillFromUser('user-1', 'skill-1');

      expect(result.message).toBe('Compétence retirée avec succès');
    });

    it('should throw error when user skill not found', async () => {
      mockPrismaService.userSkill.findUnique.mockResolvedValue(null);

      await expect(service.removeSkillFromUser('user-1', 'skill-1'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserSkills', () => {
    it('should return user skills grouped by category', async () => {
      const mockUserSkills = [
        { userId: 'user-1', skillId: 'skill-1', level: 'EXPERT', skill: { ...mockSkill, category: 'TECHNICAL' } },
        { userId: 'user-1', skillId: 'skill-2', level: 'INTERMEDIATE', skill: { id: 'skill-2', name: 'React', category: 'TECHNICAL' } },
      ];
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.userSkill.findMany.mockResolvedValue(mockUserSkills);

      const result = await service.getUserSkills('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.total).toBe(2);
      expect(result.skills).toHaveLength(2);
      expect(result.byCategory).toHaveProperty('TECHNICAL');
    });

    it('should throw error when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserSkills('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSkillsMatrix', () => {
    it('should return skills matrix for all users', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          role: 'CONTRIBUTEUR',
          departmentId: 'dept-1',
          department: { id: 'dept-1', name: 'IT' },
          skills: [{ skill: mockSkill, level: 'EXPERT' }],
        },
      ];
      const mockSkills = [mockSkill];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.skill.findMany.mockResolvedValue(mockSkills);

      const result = await service.getSkillsMatrix();

      expect(result.totalUsers).toBe(1);
      expect(result.totalSkills).toBe(1);
      expect(result.matrix).toHaveLength(1);
      expect(result.matrix[0].skills).toHaveLength(1);
    });

    it('should filter by departmentId', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.skill.findMany.mockResolvedValue([]);

      await service.getSkillsMatrix('dept-1');

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ departmentId: 'dept-1' }),
        }),
      );
    });

    it('should filter by skillCategory', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.skill.findMany.mockResolvedValue([]);

      await service.getSkillsMatrix(undefined, 'TECHNICAL' as any);

      expect(mockPrismaService.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'TECHNICAL' }),
        }),
      );
    });
  });

  describe('findUsersBySkill', () => {
    it('should return users with specific skill', async () => {
      const mockUserSkills = [
        {
          userId: 'user-1',
          skillId: 'skill-1',
          level: 'EXPERT',
          user: {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@test.com',
            role: 'CONTRIBUTEUR',
            avatarUrl: null,
            isActive: true,
            department: { id: 'dept-1', name: 'IT' },
            userServices: [],
          },
        },
      ];

      mockPrismaService.skill.findUnique.mockResolvedValue(mockSkill);
      mockPrismaService.userSkill.findMany.mockResolvedValue(mockUserSkills);

      const result = await service.findUsersBySkill('skill-1');

      expect(result.skill.id).toBe('skill-1');
      expect(result.totalUsers).toBe(1);
      expect(result.users).toHaveLength(1);
    });

    it('should throw error when skill not found', async () => {
      mockPrismaService.skill.findUnique.mockResolvedValue(null);

      await expect(service.findUsersBySkill('invalid')).rejects.toThrow(NotFoundException);
    });

    it('should filter by minimum level', async () => {
      const mockUserSkills = [
        {
          userId: 'user-1',
          level: 'EXPERT',
          user: { id: 'user-1', isActive: true, firstName: 'John', lastName: 'Doe' },
        },
      ];

      mockPrismaService.skill.findUnique.mockResolvedValue(mockSkill);
      mockPrismaService.userSkill.findMany.mockResolvedValue(mockUserSkills);

      const result = await service.findUsersBySkill('skill-1', 'INTERMEDIATE' as any);

      expect(result.users).toHaveLength(1);
    });

    it('should only return active users', async () => {
      const mockUserSkills = [
        { userId: 'user-1', level: 'EXPERT', user: { id: 'user-1', isActive: true, firstName: 'John', lastName: 'Doe' } },
        { userId: 'user-2', level: 'EXPERT', user: { id: 'user-2', isActive: false, firstName: 'Jane', lastName: 'Doe' } },
      ];

      mockPrismaService.skill.findUnique.mockResolvedValue(mockSkill);
      mockPrismaService.userSkill.findMany.mockResolvedValue(mockUserSkills);

      const result = await service.findUsersBySkill('skill-1');

      expect(result.totalUsers).toBe(1);
    });
  });
});
