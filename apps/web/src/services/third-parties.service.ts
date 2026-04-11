import { api } from "@/lib/api";
import {
  CreateThirdPartyDto,
  PaginatedResponse,
  ProjectThirdPartyMember,
  QueryThirdPartyDto,
  TaskThirdPartyAssignee,
  ThirdParty,
  ThirdPartyDeletionImpact,
  UpdateThirdPartyDto,
} from "@/types";

export const thirdPartiesService = {
  async getAll(
    query: QueryThirdPartyDto = {},
  ): Promise<PaginatedResponse<ThirdParty>> {
    const params = new URLSearchParams();
    if (query.type) params.append("type", query.type);
    if (query.isActive !== undefined)
      params.append("isActive", String(query.isActive));
    if (query.search) params.append("search", query.search);
    if (query.page !== undefined) params.append("page", String(query.page));
    if (query.limit !== undefined) params.append("limit", String(query.limit));

    const response = await api.get<PaginatedResponse<ThirdParty>>(
      `/third-parties?${params.toString()}`,
    );
    return response.data;
  },

  async getById(id: string): Promise<ThirdParty> {
    const response = await api.get<ThirdParty>(`/third-parties/${id}`);
    return response.data;
  },

  async getDeletionImpact(id: string): Promise<ThirdPartyDeletionImpact> {
    const response = await api.get<ThirdPartyDeletionImpact>(
      `/third-parties/${id}/deletion-impact`,
    );
    return response.data;
  },

  async create(data: CreateThirdPartyDto): Promise<ThirdParty> {
    const response = await api.post<ThirdParty>("/third-parties", data);
    return response.data;
  },

  async update(id: string, data: UpdateThirdPartyDto): Promise<ThirdParty> {
    const response = await api.patch<ThirdParty>(`/third-parties/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/third-parties/${id}`);
  },

  // ===== Task assignments =====

  async listTaskAssignees(taskId: string): Promise<TaskThirdPartyAssignee[]> {
    const response = await api.get<TaskThirdPartyAssignee[]>(
      `/tasks/${taskId}/third-party-assignees`,
    );
    return response.data;
  },

  async assignToTask(
    taskId: string,
    thirdPartyId: string,
  ): Promise<TaskThirdPartyAssignee> {
    const response = await api.post<TaskThirdPartyAssignee>(
      `/tasks/${taskId}/third-party-assignees`,
      { thirdPartyId },
    );
    return response.data;
  },

  async unassignFromTask(
    taskId: string,
    thirdPartyId: string,
  ): Promise<void> {
    await api.delete(
      `/tasks/${taskId}/third-party-assignees/${thirdPartyId}`,
    );
  },

  // ===== Project memberships =====

  async listProjectMembers(
    projectId: string,
  ): Promise<ProjectThirdPartyMember[]> {
    const response = await api.get<ProjectThirdPartyMember[]>(
      `/projects/${projectId}/third-party-members`,
    );
    return response.data;
  },

  async attachToProject(
    projectId: string,
    thirdPartyId: string,
    allocation?: number,
  ): Promise<ProjectThirdPartyMember> {
    const response = await api.post<ProjectThirdPartyMember>(
      `/projects/${projectId}/third-party-members`,
      { thirdPartyId, allocation },
    );
    return response.data;
  },

  async detachFromProject(
    projectId: string,
    thirdPartyId: string,
  ): Promise<void> {
    await api.delete(
      `/projects/${projectId}/third-party-members/${thirdPartyId}`,
    );
  },
};
