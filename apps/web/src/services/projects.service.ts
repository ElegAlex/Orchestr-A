import { api } from "@/lib/api";
import {
  Project,
  PaginatedResponse,
  ProjectStatus,
  CreateProjectDto,
  UpdateProjectDto,
  AddMemberDto,
  ProjectStats,
} from "@/types";

export const projectsService = {
  async getAll(
    page?: number,
    limit?: number,
    status?: ProjectStatus,
  ): Promise<PaginatedResponse<Project>> {
    const params = new URLSearchParams();
    if (page !== undefined) params.append("page", page.toString());
    if (limit !== undefined) params.append("limit", limit.toString());
    if (status) params.append("status", status);

    const response = await api.get<PaginatedResponse<Project>>(
      `/projects?${params.toString()}`,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await api.get<any>(`/projects/${id}/stats`);
    const d = response.data;
    return {
      totalTasks: d.tasks?.total ?? 0,
      completedTasks: d.tasks?.completed ?? 0,
      inProgressTasks: d.tasks?.inProgress ?? 0,
      blockedTasks: d.tasks?.blocked ?? 0,
      progress: d.progress ?? 0,
      totalHours: d.hours?.estimated ?? 0,
      loggedHours: d.hours?.actual ?? 0,
      remainingHours: d.hours?.remaining ?? 0,
      membersCount: d.team?.totalMembers ?? 0,
      epicsCount: d.epics?.total ?? 0,
      milestonesCount: d.milestones?.total ?? 0,
    };
  },

  async create(data: CreateProjectDto): Promise<Project> {
    const response = await api.post<Project>("/projects", data);
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
