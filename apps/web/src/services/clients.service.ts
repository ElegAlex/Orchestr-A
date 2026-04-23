import { api } from "@/lib/api";
import {
  Client,
  ClientDeletionImpact,
  ClientProjectsResponse,
  CreateClientDto,
  PaginatedResponse,
  ProjectClient,
  QueryClientDto,
  UpdateClientDto,
} from "@/types";

export const clientsService = {
  async getAll(
    query: QueryClientDto = {},
  ): Promise<PaginatedResponse<Client>> {
    const params = new URLSearchParams();
    if (query.isActive !== undefined)
      params.append("isActive", String(query.isActive));
    if (query.search) params.append("search", query.search);
    if (query.page !== undefined) params.append("page", String(query.page));
    if (query.limit !== undefined) params.append("limit", String(query.limit));

    const response = await api.get<PaginatedResponse<Client>>(
      `/clients?${params.toString()}`,
    );
    return response.data;
  },

  async getById(id: string): Promise<Client> {
    const response = await api.get<Client>(`/clients/${id}`);
    return response.data;
  },

  async getDeletionImpact(id: string): Promise<ClientDeletionImpact> {
    const response = await api.get<ClientDeletionImpact>(
      `/clients/${id}/deletion-impact`,
    );
    return response.data;
  },

  async getProjectsWithSummary(id: string): Promise<ClientProjectsResponse> {
    const response = await api.get<ClientProjectsResponse>(
      `/clients/${id}/projects`,
    );
    return response.data;
  },

  async create(data: CreateClientDto): Promise<Client> {
    const response = await api.post<Client>("/clients", data);
    return response.data;
  },

  async update(id: string, data: UpdateClientDto): Promise<Client> {
    const response = await api.patch<Client>(`/clients/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/clients/${id}`);
  },

  // ===== Project memberships =====

  async listProjectClients(projectId: string): Promise<ProjectClient[]> {
    const response = await api.get<ProjectClient[]>(
      `/projects/${projectId}/clients`,
    );
    return response.data;
  },

  async attachToProject(
    projectId: string,
    clientId: string,
  ): Promise<ProjectClient> {
    const response = await api.post<ProjectClient>(
      `/projects/${projectId}/clients`,
      { clientId },
    );
    return response.data;
  },

  async detachFromProject(
    projectId: string,
    clientId: string,
  ): Promise<void> {
    await api.delete(`/projects/${projectId}/clients/${clientId}`);
  },
};
