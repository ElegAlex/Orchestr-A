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
    const response = await api.get<PaginatedResponse<Task> | Task[]>(
      `/tasks?startDate=${startDate}&endDate=${endDate}`
    );
    // L'API retourne {data: [], meta: {}} - extraire le tableau
    if (response.data && 'data' in response.data) {
      return response.data.data;
    }
    return Array.isArray(response.data) ? response.data : [];
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

  async getImportTemplate(projectId: string): Promise<string> {
    const response = await api.get<{ template: string }>(
      `/tasks/project/${projectId}/import-template`
    );
    return response.data.template;
  },

  async validateImport(
    projectId: string,
    tasks: Array<{
      title: string;
      description?: string;
      status?: string;
      priority?: string;
      assigneeEmail?: string;
      milestoneName?: string;
      estimatedHours?: number;
      startDate?: string;
      endDate?: string;
    }>
  ): Promise<TasksValidationPreview> {
    const response = await api.post<TasksValidationPreview>(
      `/tasks/project/${projectId}/import/validate`,
      { tasks }
    );
    return response.data;
  },

  async importTasks(
    projectId: string,
    tasks: Array<{
      title: string;
      description?: string;
      status?: string;
      priority?: string;
      assigneeEmail?: string;
      milestoneName?: string;
      estimatedHours?: number;
      startDate?: string;
      endDate?: string;
    }>
  ): Promise<{
    created: number;
    skipped: number;
    errors: number;
    errorDetails: string[];
  }> {
    const response = await api.post<{
      created: number;
      skipped: number;
      errors: number;
      errorDetails: string[];
    }>(`/tasks/project/${projectId}/import`, { tasks });
    return response.data;
  },

  /**
   * Recupere les taches orphelines (sans projet)
   */
  async getOrphans(): Promise<Task[]> {
    const response = await api.get<Task[]>('/tasks/orphans');
    return response.data;
  },

  /**
   * Rattache une tache a un projet
   */
  async attachToProject(taskId: string, projectId: string): Promise<Task> {
    const response = await api.post<Task>(`/tasks/${taskId}/attach-project`, {
      projectId,
    });
    return response.data;
  },

  /**
   * Detache une tache de son projet (la rend orpheline)
   */
  async detachFromProject(taskId: string): Promise<Task> {
    const response = await api.post<Task>(`/tasks/${taskId}/detach-project`);
    return response.data;
  },
};

// Types pour la prévisualisation d'import
export interface TaskPreviewItem {
  lineNumber: number;
  task: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    assigneeEmail?: string;
    milestoneName?: string;
    estimatedHours?: number;
    startDate?: string;
    endDate?: string;
  };
  status: 'valid' | 'duplicate' | 'error' | 'warning';
  messages: string[];
  resolvedAssignee?: { id: string; email: string; name: string };
  resolvedMilestone?: { id: string; name: string };
}

export interface TasksValidationPreview {
  valid: TaskPreviewItem[];
  duplicates: TaskPreviewItem[];
  errors: TaskPreviewItem[];
  warnings: TaskPreviewItem[];
  summary: {
    total: number;
    valid: number;
    duplicates: number;
    errors: number;
    warnings: number;
  };
}
