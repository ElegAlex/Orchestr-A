import { api } from '@/lib/api';
import { Skill, SkillCategory, SkillLevel, User, UserSkill } from '@/types';

export interface CreateSkillDto {
  name: string;
  category: SkillCategory;
  description?: string;
}

export interface UpdateSkillDto {
  name?: string;
  category?: SkillCategory;
  description?: string;
}

export interface AssignSkillDto {
  skillId: string;
  level: SkillLevel;
}

interface SkillsResponse {
  data: Skill[];
  meta?: { total: number; page: number; limit: number };
}

interface SkillMatrix {
  users: User[];
  skills: Skill[];
  matrix: Record<string, Record<string, SkillLevel>>;
}

export const skillsService = {
  // Récupérer toutes les compétences
  async getAll(page?: number, limit?: number, category?: SkillCategory): Promise<SkillsResponse> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (category) params.append('category', category);

    const response = await api.get<SkillsResponse>(`/skills?${params.toString()}`);
    return response.data;
  },

  // Récupérer une compétence par ID
  async getById(id: string): Promise<Skill> {
    const response = await api.get<Skill>(`/skills/${id}`);
    return response.data;
  },

  // Créer une compétence
  async create(data: CreateSkillDto): Promise<Skill> {
    const response = await api.post<Skill>('/skills', data);
    return response.data;
  },

  // Mettre à jour une compétence
  async update(id: string, data: UpdateSkillDto): Promise<Skill> {
    const response = await api.patch<Skill>(`/skills/${id}`, data);
    return response.data;
  },

  // Supprimer une compétence
  async delete(id: string): Promise<void> {
    await api.delete(`/skills/${id}`);
  },

  // Assigner une compétence à un utilisateur
  async assignToUser(userId: string, data: AssignSkillDto): Promise<UserSkill> {
    const response = await api.post<UserSkill>(`/skills/user/${userId}/assign`, data);
    return response.data;
  },

  // Assigner une compétence à soi-même
  async assignToMe(data: AssignSkillDto): Promise<UserSkill> {
    const response = await api.post<UserSkill>('/skills/me/assign', data);
    return response.data;
  },

  // Retirer une compétence d'un utilisateur
  async removeFromUser(userId: string, skillId: string): Promise<void> {
    await api.delete(`/skills/user/${userId}/remove/${skillId}`);
  },

  // Retirer une compétence de soi-même
  async removeFromMe(skillId: string): Promise<void> {
    await api.delete(`/skills/me/remove/${skillId}`);
  },

  // Récupérer les compétences d'un utilisateur
  async getUserSkills(userId: string): Promise<UserSkill[]> {
    // L'API retourne { userId, total, skills, byCategory } - on extrait le tableau skills
    const response = await api.get<{ userId: string; total: number; skills: UserSkill[]; byCategory: Record<string, UserSkill[]> }>(`/skills/user/${userId}`);
    return response.data.skills || [];
  },

  // Récupérer mes compétences
  async getMySkills(): Promise<UserSkill[]> {
    const response = await api.get<UserSkill[]>('/skills/me/my-skills');
    return response.data;
  },

  // Récupérer la matrice de compétences
  async getMatrix(departmentId?: string, category?: SkillCategory): Promise<SkillMatrix> {
    const params = new URLSearchParams();
    if (departmentId) params.append('departmentId', departmentId);
    if (category) params.append('category', category);

    const response = await api.get<SkillMatrix>(`/skills/matrix?${params.toString()}`);
    return response.data;
  },

  // Rechercher des utilisateurs par compétence
  async findUsersBySkill(skillId: string, minLevel?: SkillLevel): Promise<User[]> {
    const params = new URLSearchParams();
    if (minLevel) params.append('minLevel', minLevel);

    const response = await api.get<User[]>(`/skills/search/${skillId}?${params.toString()}`);
    return response.data;
  },

  // Mettre à jour le niveau d'une compétence utilisateur
  async updateUserSkill(userId: string, skillId: string, data: { level: SkillLevel }): Promise<UserSkill> {
    const response = await api.patch<UserSkill>(`/skills/user/${userId}/skill/${skillId}`, data);
    return response.data;
  },
};
