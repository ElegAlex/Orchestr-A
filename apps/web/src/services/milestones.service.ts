import { api } from '@/lib/api';
import { Milestone, PaginatedResponse } from '@/types';

export const milestonesService = {
  async getAll(): Promise<PaginatedResponse<Milestone>> {
    const response = await api.get<PaginatedResponse<Milestone>>('/milestones');
    return response.data;
  },

  async getById(id: string): Promise<Milestone> {
    const response = await api.get<Milestone>(`/milestones/${id}`);
    return response.data;
  },

  async getByProject(projectId: string): Promise<Milestone[]> {
    const response = await api.get<Milestone[]>(`/milestones/project/${projectId}`);
    return response.data;
  },

  async create(data: {
    name: string;
    description?: string;
    dueDate: string;
    projectId: string;
  }): Promise<Milestone> {
    const response = await api.post<Milestone>('/milestones', data);
    return response.data;
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      description?: string;
      dueDate: string;
      status: string;
    }>
  ): Promise<Milestone> {
    const response = await api.patch<Milestone>(`/milestones/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/milestones/${id}`);
  },
};
