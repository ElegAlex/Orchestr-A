import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('SkillsController', () => {
  let controller: SkillsController;
  let skillsService: SkillsService;

  const mockSkill = {
    id: 'skill-id-1',
    name: 'TypeScript',
    category: 'TECHNICAL',
    description: 'TypeScript programming language',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserSkill = {
    userId: 'user-id-1',
    skillId: 'skill-id-1',
    level: 'EXPERT',
    validatedBy: 'manager-id-1',
    skill: mockSkill,
  };

  const mockSkillsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getSkillsMatrix: vi.fn(),
    findUsersBySkill: vi.fn(),
    assignSkillToUser: vi.fn(),
    removeSkillFromUser: vi.fn(),
    getUserSkills: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SkillsController],
      providers: [
        {
          provide: SkillsService,
          useValue: mockSkillsService,
        },
      ],
    }).compile();

    controller = module.get<SkillsController>(SkillsController);
    skillsService = module.get<SkillsService>(SkillsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createSkillDto = {
      name: 'TypeScript',
      category: 'TECHNICAL' as const,
      description: 'TypeScript programming language',
    };

    it('should create a skill successfully', async () => {
      mockSkillsService.create.mockResolvedValue(mockSkill);

      const result = await controller.create(createSkillDto);

      expect(result).toEqual(mockSkill);
      expect(mockSkillsService.create).toHaveBeenCalledWith(createSkillDto);
      expect(mockSkillsService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when skill name already exists', async () => {
      mockSkillsService.create.mockRejectedValue(
        new ConflictException('Une compétence avec ce nom existe déjà')
      );

      await expect(controller.create(createSkillDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated skills', async () => {
      const paginatedResult = {
        data: [mockSkill],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockSkillsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockSkillsService.findAll).toHaveBeenCalledWith(1, 10, undefined);
    });

    it('should filter skills by category', async () => {
      const technicalSkills = {
        data: [mockSkill],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockSkillsService.findAll.mockResolvedValue(technicalSkills);

      const result = await controller.findAll(1, 10, 'TECHNICAL' as any);

      expect(result.data[0].category).toBe('TECHNICAL');
      expect(mockSkillsService.findAll).toHaveBeenCalledWith(1, 10, 'TECHNICAL');
    });
  });

  describe('findOne', () => {
    it('should return a skill by id', async () => {
      mockSkillsService.findOne.mockResolvedValue(mockSkill);

      const result = await controller.findOne('skill-id-1');

      expect(result).toEqual(mockSkill);
      expect(mockSkillsService.findOne).toHaveBeenCalledWith('skill-id-1');
    });

    it('should throw NotFoundException when skill not found', async () => {
      mockSkillsService.findOne.mockRejectedValue(
        new NotFoundException('Compétence introuvable')
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMatrix', () => {
    it('should return skills matrix', async () => {
      const matrix = {
        users: [{ id: 'user-1', name: 'John Doe' }],
        skills: [mockSkill],
        data: [
          { userId: 'user-1', skillId: 'skill-id-1', level: 'EXPERT' },
        ],
      };

      mockSkillsService.getSkillsMatrix.mockResolvedValue(matrix);

      const result = await controller.getMatrix();

      expect(result).toEqual(matrix);
      expect(mockSkillsService.getSkillsMatrix).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should filter matrix by department', async () => {
      const matrix = { users: [], skills: [], data: [] };
      mockSkillsService.getSkillsMatrix.mockResolvedValue(matrix);

      await controller.getMatrix('dept-1');

      expect(mockSkillsService.getSkillsMatrix).toHaveBeenCalledWith('dept-1', undefined);
    });

    it('should filter matrix by category', async () => {
      const matrix = { users: [], skills: [], data: [] };
      mockSkillsService.getSkillsMatrix.mockResolvedValue(matrix);

      await controller.getMatrix(undefined, 'TECHNICAL' as any);

      expect(mockSkillsService.getSkillsMatrix).toHaveBeenCalledWith(undefined, 'TECHNICAL');
    });
  });

  describe('findUsersBySkill', () => {
    it('should return users with a specific skill', async () => {
      const usersWithSkill = [
        { userId: 'user-1', firstName: 'John', lastName: 'Doe', level: 'EXPERT' },
      ];

      mockSkillsService.findUsersBySkill.mockResolvedValue(usersWithSkill);

      const result = await controller.findUsersBySkill('skill-id-1');

      expect(result).toEqual(usersWithSkill);
      expect(mockSkillsService.findUsersBySkill).toHaveBeenCalledWith('skill-id-1', undefined);
    });

    it('should filter by minimum level', async () => {
      const experts = [{ userId: 'user-1', level: 'EXPERT' }];
      mockSkillsService.findUsersBySkill.mockResolvedValue(experts);

      await controller.findUsersBySkill('skill-id-1', 'EXPERT' as any);

      expect(mockSkillsService.findUsersBySkill).toHaveBeenCalledWith('skill-id-1', 'EXPERT');
    });
  });

  describe('update', () => {
    const updateSkillDto = {
      name: 'TypeScript Advanced',
    };

    it('should update a skill successfully', async () => {
      const updatedSkill = { ...mockSkill, name: 'TypeScript Advanced' };
      mockSkillsService.update.mockResolvedValue(updatedSkill);

      const result = await controller.update('skill-id-1', updateSkillDto);

      expect(result.name).toBe('TypeScript Advanced');
      expect(mockSkillsService.update).toHaveBeenCalledWith('skill-id-1', updateSkillDto);
    });

    it('should throw NotFoundException when skill not found', async () => {
      mockSkillsService.update.mockRejectedValue(
        new NotFoundException('Compétence introuvable')
      );

      await expect(controller.update('nonexistent', updateSkillDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ConflictException when name already exists', async () => {
      mockSkillsService.update.mockRejectedValue(
        new ConflictException('Une compétence avec ce nom existe déjà')
      );

      await expect(controller.update('skill-id-1', { name: 'Existing' })).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe('remove', () => {
    it('should delete a skill successfully', async () => {
      mockSkillsService.remove.mockResolvedValue({ message: 'Compétence supprimée' });

      const result = await controller.remove('skill-id-1');

      expect(result.message).toBe('Compétence supprimée');
      expect(mockSkillsService.remove).toHaveBeenCalledWith('skill-id-1');
    });

    it('should throw BadRequestException when skill is assigned to users', async () => {
      mockSkillsService.remove.mockRejectedValue(
        new BadRequestException('Impossible de supprimer (assignée à des utilisateurs)')
      );

      await expect(controller.remove('skill-id-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when skill not found', async () => {
      mockSkillsService.remove.mockRejectedValue(
        new NotFoundException('Compétence introuvable')
      );

      await expect(controller.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignToMe', () => {
    const assignSkillDto = {
      skillId: 'skill-id-1',
      level: 'INTERMEDIATE' as const,
    };

    it('should assign skill to current user', async () => {
      mockSkillsService.assignSkillToUser.mockResolvedValue(mockUserSkill);

      const result = await controller.assignToMe('user-id-1', assignSkillDto);

      expect(result).toEqual(mockUserSkill);
      expect(mockSkillsService.assignSkillToUser).toHaveBeenCalledWith('user-id-1', assignSkillDto);
    });

    it('should throw NotFoundException when skill not found', async () => {
      mockSkillsService.assignSkillToUser.mockRejectedValue(
        new NotFoundException('Compétence introuvable')
      );

      await expect(controller.assignToMe('user-id-1', assignSkillDto)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('assignToUser', () => {
    const assignSkillDto = {
      skillId: 'skill-id-1',
      level: 'EXPERT' as const,
    };

    it('should assign skill to specified user (admin)', async () => {
      mockSkillsService.assignSkillToUser.mockResolvedValue(mockUserSkill);

      const result = await controller.assignToUser('user-id-2', assignSkillDto);

      expect(result).toEqual(mockUserSkill);
      expect(mockSkillsService.assignSkillToUser).toHaveBeenCalledWith('user-id-2', assignSkillDto);
    });
  });

  describe('removeFromMe', () => {
    it('should remove skill from current user', async () => {
      mockSkillsService.removeSkillFromUser.mockResolvedValue({ message: 'Compétence retirée' });

      const result = await controller.removeFromMe('user-id-1', 'skill-id-1');

      expect(result.message).toBe('Compétence retirée');
      expect(mockSkillsService.removeSkillFromUser).toHaveBeenCalledWith('user-id-1', 'skill-id-1');
    });

    it('should throw NotFoundException when user does not have skill', async () => {
      mockSkillsService.removeSkillFromUser.mockRejectedValue(
        new NotFoundException('Compétence non trouvée pour cet utilisateur')
      );

      await expect(controller.removeFromMe('user-id-1', 'skill-id-1')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('removeFromUser', () => {
    it('should remove skill from specified user (admin)', async () => {
      mockSkillsService.removeSkillFromUser.mockResolvedValue({ message: 'Compétence retirée' });

      const result = await controller.removeFromUser('user-id-2', 'skill-id-1');

      expect(result.message).toBe('Compétence retirée');
      expect(mockSkillsService.removeSkillFromUser).toHaveBeenCalledWith('user-id-2', 'skill-id-1');
    });
  });

  describe('getUserSkills', () => {
    it('should return skills for specified user', async () => {
      const userSkills = {
        TECHNICAL: [{ skill: mockSkill, level: 'EXPERT' }],
        SOFT_SKILL: [],
      };

      mockSkillsService.getUserSkills.mockResolvedValue(userSkills);

      const result = await controller.getUserSkills('user-id-1');

      expect(result).toEqual(userSkills);
      expect(mockSkillsService.getUserSkills).toHaveBeenCalledWith('user-id-1');
    });
  });

  describe('getMySkills', () => {
    it('should return skills for current user', async () => {
      const mySkills = {
        TECHNICAL: [{ skill: mockSkill, level: 'EXPERT' }],
      };

      mockSkillsService.getUserSkills.mockResolvedValue(mySkills);

      const result = await controller.getMySkills('user-id-1');

      expect(result).toEqual(mySkills);
      expect(mockSkillsService.getUserSkills).toHaveBeenCalledWith('user-id-1');
    });
  });

  describe('updateUserSkill', () => {
    it('should update skill level for user', async () => {
      const updatedSkill = { ...mockUserSkill, level: 'MASTER' };
      mockSkillsService.assignSkillToUser.mockResolvedValue(updatedSkill);

      const result = await controller.updateUserSkill('user-id-1', 'skill-id-1', {
        level: 'MASTER' as any,
      });

      expect(result.level).toBe('MASTER');
      expect(mockSkillsService.assignSkillToUser).toHaveBeenCalledWith('user-id-1', {
        skillId: 'skill-id-1',
        level: 'MASTER',
      });
    });
  });
});
