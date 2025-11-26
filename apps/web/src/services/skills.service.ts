import { api } from '@/lib/api';
import { Skill, SkillCategory, SkillLevel } from '@/types';

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

export const skillsService = {
  // Récupérer toutes les compétences
  async getAll(page?: number, limit?: number, category?: SkillCategory) {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (category) params.append('category', category);

    const response = await api.get(`/skills?${params.toString()}`);
    return response.data;
  },

  // Récupérer une compétence par ID
  async getById(id: string) {
    const response = await api.get(`/skills/${id}`);
    return response.data;
  },

  // Créer une compétence
  async create(data: CreateSkillDto) {
    const response = await api.post('/skills', data);
    return response.data;
  },

  // Mettre à jour une compétence
  async update(id: string, data: UpdateSkillDto) {
    const response = await api.patch(`/skills/${id}`, data);
    return response.data;
  },

  // Supprimer une compétence
  async delete(id: string) {
    const response = await api.delete(`/skills/${id}`);
    return response.data;
  },

  // Assigner une compétence à un utilisateur
  async assignToUser(userId: string, data: AssignSkillDto) {
    const response = await api.post(`/skills/user/${userId}/assign`, data);
    return response.data;
  },

  // Assigner une compétence à soi-même
  async assignToMe(data: AssignSkillDto) {
    const response = await api.post('/skills/me/assign', data);
    return response.data;
  },

  // Retirer une compétence d'un utilisateur
  async removeFromUser(userId: string, skillId: string) {
    const response = await api.delete(`/skills/user/${userId}/remove/${skillId}`);
    return response.data;
  },

  // Retirer une compétence de soi-même
  async removeFromMe(skillId: string) {
    const response = await api.delete(`/skills/me/remove/${skillId}`);
    return response.data;
  },

  // Récupérer les compétences d'un utilisateur
  async getUserSkills(userId: string) {
    const response = await api.get(`/skills/user/${userId}`);
    return response.data;
  },

  // Récupérer mes compétences
  async getMySkills() {
    const response = await api.get('/skills/me/my-skills');
    return response.data;
  },

  // Récupérer la matrice de compétences
  async getMatrix(departmentId?: string, category?: SkillCategory) {
    const params = new URLSearchParams();
    if (departmentId) params.append('departmentId', departmentId);
    if (category) params.append('category', category);

    const response = await api.get(`/skills/matrix?${params.toString()}`);
    return response.data;
  },

  // Rechercher des utilisateurs par compétence
  async findUsersBySkill(skillId: string, minLevel?: SkillLevel) {
    const params = new URLSearchParams();
    if (minLevel) params.append('minLevel', minLevel);

    const response = await api.get(`/skills/search/${skillId}?${params.toString()}`);
    return response.data;
  },

  // Mettre à jour le niveau d'une compétence utilisateur
  async updateUserSkill(userId: string, skillId: string, data: { level: SkillLevel }) {
    const response = await api.patch(`/skills/user/${userId}/skill/${skillId}`, data);
    return response.data;
  },
};
