import { api } from '@/lib/api';
import {
  Project,
  PaginatedResponse,
  ProjectStatus,
  CreateProjectDto,
  UpdateProjectDto,
  AddMemberDto,
  ProjectStats,
} from '@/types';

export const projectsService = {
  async getAll(
    page?: number,
    limit?: number,
    status?: ProjectStatus
  ): Promise<PaginatedResponse<Project>> {
    const params = new URLSearchParams();
    if (page !== undefined) params.append('page', page.toString());
    if (limit !== undefined) params.append('limit', limit.toString());
    if (status) params.append('status', status);

    const response = await api.get<PaginatedResponse<Project>>(
      `/projects?${params.toString()}`
    );
    return response.data;
  },

  async getById(id: string): Promise<Project> {
    const response = await api.get<Project>(`/projects/${id}`);
    return response.data;
  },

  async getByUser(userId: string): Promise<Project[]> {
    const response = await api.get<Project[]>(`/projects/user/${userId}`);
    return response.data;
  },

  async getStats(id: string): Promise<ProjectStats> {
    const response = await api.get<ProjectStats>(`/projects/${id}/stats`);
    return response.data;
  },

  async create(data: CreateProjectDto): Promise<Project> {
    const response = await api.post<Project>('/projects', data);
    return response.data;
  },

  async update(id: string, data: UpdateProjectDto): Promise<Project> {
    const response = await api.patch<Project>(`/projects/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/projects/${id}`);
  },

  async hardDelete(id: string): Promise<void> {
    await api.delete(`/projects/${id}/hard`);
  },

  async addMember(projectId: string, data: AddMemberDto): Promise<void> {
    await api.post(`/projects/${projectId}/members`, data);
  },

  async removeMember(projectId: string, userId: string): Promise<void> {
    await api.delete(`/projects/${projectId}/members/${userId}`);
  },
};
