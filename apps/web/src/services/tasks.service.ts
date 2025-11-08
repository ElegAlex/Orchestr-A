import { api } from '@/lib/api';
import {
  Task,
  PaginatedResponse,
  TaskStatus,
  Priority,
  CreateTaskDto,
  UpdateTaskDto,
} from '@/types';

export const tasksService = {
  async getAll(
    page?: number,
    limit?: number,
    status?: TaskStatus,
    priority?: Priority
  ): Promise<PaginatedResponse<Task>> {
    const params = new URLSearchParams();
    if (page !== undefined) params.append('page', page.toString());
    if (limit !== undefined) params.append('limit', limit.toString());
    if (status) params.append('status', status);
    if (priority) params.append('priority', priority);

    const response = await api.get<PaginatedResponse<Task>>(
      `/tasks?${params.toString()}`
    );
    return response.data;
  },

  async getById(id: string): Promise<Task> {
    const response = await api.get<Task>(`/tasks/${id}`);
    return response.data;
  },

  async getByProject(projectId: string): Promise<Task[]> {
    const response = await api.get<Task[]>(`/tasks/project/${projectId}`);
    return response.data;
  },

  async getByAssignee(userId: string): Promise<Task[]> {
    const response = await api.get<Task[]>(`/tasks/assignee/${userId}`);
    return response.data;
  },

  async getByEpic(epicId: string): Promise<Task[]> {
    const response = await api.get<Task[]>(`/tasks/epic/${epicId}`);
    return response.data;
  },

  async getByMilestone(milestoneId: string): Promise<Task[]> {
    const response = await api.get<Task[]>(`/tasks/milestone/${milestoneId}`);
    return response.data;
  },

  async getByDateRange(startDate: string, endDate: string): Promise<Task[]> {
    const response = await api.get<Task[]>(
      `/tasks?startDate=${startDate}&endDate=${endDate}`
    );
    return response.data;
  },

  async create(data: CreateTaskDto): Promise<Task> {
    const response = await api.post<Task>('/tasks', data);
    return response.data;
  },

  async update(id: string, data: UpdateTaskDto): Promise<Task> {
    const response = await api.patch<Task>(`/tasks/${id}`, data);
    return response.data;
  },

  async updateProgress(id: string, progress: number): Promise<Task> {
    const response = await api.patch<Task>(`/tasks/${id}/progress`, {
      progress,
    });
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/tasks/${id}`);
  },

  async addDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
    await api.post(`/tasks/${taskId}/dependencies`, { dependsOnTaskId });
  },

  async removeDependency(taskId: string, dependencyId: string): Promise<void> {
    await api.delete(`/tasks/${taskId}/dependencies/${dependencyId}`);
  },

  async assignRaci(
    taskId: string,
    userId: string,
    role: string
  ): Promise<void> {
    await api.post(`/tasks/${taskId}/raci`, { userId, role });
  },

  async removeRaci(taskId: string, raciId: string): Promise<void> {
    await api.delete(`/tasks/${taskId}/raci/${raciId}`);
  },
};
