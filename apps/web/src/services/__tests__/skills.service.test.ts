import { skillsService } from '../skills.service';
import { api } from '@/lib/api';
import { SkillCategory, SkillLevel } from '@/types';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('skillsService', () => {
  const mockSkill = {
    id: 'skill-1',
    name: 'TypeScript',
    category: SkillCategory.TECHNICAL,
    description: 'TypeScript programming language',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  };

  const mockSkills = [mockSkill, { ...mockSkill, id: 'skill-2', name: 'React' }];

  const mockUserSkill = {
    userId: 'user-1',
    skillId: 'skill-1',
    level: SkillLevel.EXPERT,
    skill: mockSkill,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should fetch all skills without filters', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockSkills });

      const result = await skillsService.getAll();

      expect(api.get).toHaveBeenCalledWith('/skills?');
      expect(result).toEqual(mockSkills);
    });

    it('should fetch skills with pagination', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockSkills });

      await skillsService.getAll(1, 10);

      expect(api.get).toHaveBeenCalledWith('/skills?page=1&limit=10');
    });

    it('should filter by category', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockSkills });

      await skillsService.getAll(undefined, undefined, SkillCategory.TECHNICAL);

      expect(api.get).toHaveBeenCalledWith('/skills?category=TECHNICAL');
    });
  });

  describe('getById', () => {
    it('should fetch skill by ID', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockSkill });

      const result = await skillsService.getById('skill-1');

      expect(api.get).toHaveBeenCalledWith('/skills/skill-1');
      expect(result).toEqual(mockSkill);
    });
  });

  describe('create', () => {
    it('should create a new skill', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockSkill });

      const createData = {
        name: 'TypeScript',
        category: SkillCategory.TECHNICAL,
        description: 'TypeScript programming language',
      };

      const result = await skillsService.create(createData);

      expect(api.post).toHaveBeenCalledWith('/skills', createData);
      expect(result).toEqual(mockSkill);
    });
  });

  describe('update', () => {
    it('should update a skill', async () => {
      const updatedSkill = { ...mockSkill, name: 'Updated Skill' };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedSkill });

      const result = await skillsService.update('skill-1', { name: 'Updated Skill' });

      expect(api.patch).toHaveBeenCalledWith('/skills/skill-1', { name: 'Updated Skill' });
      expect(result).toEqual(updatedSkill);
    });
  });

  describe('delete', () => {
    it('should delete a skill', async () => {
      (api.delete as jest.Mock).mockResolvedValue({ data: {} });

      await skillsService.delete('skill-1');

      expect(api.delete).toHaveBeenCalledWith('/skills/skill-1');
    });
  });

  describe('assignToUser', () => {
    it('should assign a skill to a user', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockUserSkill });

      const assignData = {
        skillId: 'skill-1',
        level: SkillLevel.EXPERT,
      };

      const result = await skillsService.assignToUser('user-1', assignData);

      expect(api.post).toHaveBeenCalledWith('/skills/user/user-1/assign', assignData);
      expect(result).toEqual(mockUserSkill);
    });
  });

  describe('assignToMe', () => {
    it('should assign a skill to current user', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockUserSkill });

      const assignData = {
        skillId: 'skill-1',
        level: SkillLevel.INTERMEDIATE,
      };

      const result = await skillsService.assignToMe(assignData);

      expect(api.post).toHaveBeenCalledWith('/skills/me/assign', assignData);
      expect(result).toEqual(mockUserSkill);
    });
  });

  describe('removeFromUser', () => {
    it('should remove a skill from a user', async () => {
      (api.delete as jest.Mock).mockResolvedValue({ data: {} });

      await skillsService.removeFromUser('user-1', 'skill-1');

      expect(api.delete).toHaveBeenCalledWith('/skills/user/user-1/remove/skill-1');
    });
  });

  describe('removeFromMe', () => {
    it('should remove a skill from current user', async () => {
      (api.delete as jest.Mock).mockResolvedValue({ data: {} });

      await skillsService.removeFromMe('skill-1');

      expect(api.delete).toHaveBeenCalledWith('/skills/me/remove/skill-1');
    });
  });

  describe('getUserSkills', () => {
    it('should fetch user skills', async () => {
      // The API returns { userId, total, skills, byCategory } structure
      (api.get as jest.Mock).mockResolvedValue({
        data: {
          userId: 'user-1',
          total: 1,
          skills: [mockUserSkill],
          byCategory: { TECHNICAL: [mockUserSkill] },
        },
      });

      const result = await skillsService.getUserSkills('user-1');

      expect(api.get).toHaveBeenCalledWith('/skills/user/user-1');
      expect(result).toEqual([mockUserSkill]);
    });
  });

  describe('getMySkills', () => {
    it('should fetch current user skills', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: [mockUserSkill] });

      const result = await skillsService.getMySkills();

      expect(api.get).toHaveBeenCalledWith('/skills/me/my-skills');
      expect(result).toEqual([mockUserSkill]);
    });
  });

  describe('getMatrix', () => {
    it('should fetch skills matrix without filters', async () => {
      const mockMatrix = { skills: mockSkills, users: [] };
      (api.get as jest.Mock).mockResolvedValue({ data: mockMatrix });

      const result = await skillsService.getMatrix();

      expect(api.get).toHaveBeenCalledWith('/skills/matrix?');
      expect(result).toEqual(mockMatrix);
    });

    it('should fetch skills matrix with filters', async () => {
      const mockMatrix = { skills: mockSkills, users: [] };
      (api.get as jest.Mock).mockResolvedValue({ data: mockMatrix });

      await skillsService.getMatrix('dept-1', SkillCategory.TECHNICAL);

      expect(api.get).toHaveBeenCalledWith('/skills/matrix?departmentId=dept-1&category=TECHNICAL');
    });
  });

  describe('findUsersBySkill', () => {
    it('should find users by skill without min level', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: [{ id: 'user-1' }] });

      const result = await skillsService.findUsersBySkill('skill-1');

      expect(api.get).toHaveBeenCalledWith('/skills/search/skill-1?');
      expect(result).toEqual([{ id: 'user-1' }]);
    });

    it('should find users by skill with min level', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: [{ id: 'user-1' }] });

      await skillsService.findUsersBySkill('skill-1', SkillLevel.EXPERT);

      expect(api.get).toHaveBeenCalledWith('/skills/search/skill-1?minLevel=EXPERT');
    });
  });

  describe('updateUserSkill', () => {
    it('should update user skill level', async () => {
      const updatedUserSkill = { ...mockUserSkill, level: SkillLevel.MASTER };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedUserSkill });

      const result = await skillsService.updateUserSkill('user-1', 'skill-1', { level: SkillLevel.MASTER });

      expect(api.patch).toHaveBeenCalledWith('/skills/user/user-1/skill/skill-1', { level: SkillLevel.MASTER });
      expect(result).toEqual(updatedUserSkill);
    });
  });
});
