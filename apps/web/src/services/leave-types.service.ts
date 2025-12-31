import { api } from "@/lib/api";

export interface LeaveTypeConfig {
  id: string;
  code: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  isPaid: boolean;
  requiresApproval: boolean;
  maxDaysPerYear?: number;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    leaves: number;
  };
}

export interface CreateLeaveTypeDto {
  code: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isPaid?: boolean;
  requiresApproval?: boolean;
  maxDaysPerYear?: number;
  sortOrder?: number;
}

export interface UpdateLeaveTypeDto {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isPaid?: boolean;
  requiresApproval?: boolean;
  maxDaysPerYear?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export const leaveTypesService = {
  async getAll(includeInactive = false): Promise<LeaveTypeConfig[]> {
    const response = await api.get<LeaveTypeConfig[]>(
      `/leave-types${includeInactive ? "?includeInactive=true" : ""}`,
    );
    return response.data;
  },

  async getById(id: string): Promise<LeaveTypeConfig> {
    const response = await api.get<LeaveTypeConfig>(`/leave-types/${id}`);
    return response.data;
  },

  async getByCode(code: string): Promise<LeaveTypeConfig> {
    const response = await api.get<LeaveTypeConfig>(
      `/leave-types/code/${code}`,
    );
    return response.data;
  },

  async create(data: CreateLeaveTypeDto): Promise<LeaveTypeConfig> {
    const response = await api.post<LeaveTypeConfig>("/leave-types", data);
    return response.data;
  },

  async update(id: string, data: UpdateLeaveTypeDto): Promise<LeaveTypeConfig> {
    const response = await api.patch<LeaveTypeConfig>(
      `/leave-types/${id}`,
      data,
    );
    return response.data;
  },

  async delete(
    id: string,
  ): Promise<{ message: string; deleted?: boolean; deactivated?: boolean }> {
    const response = await api.delete(`/leave-types/${id}`);
    return response.data;
  },

  async reorder(orderedIds: string[]): Promise<LeaveTypeConfig[]> {
    const response = await api.post<LeaveTypeConfig[]>("/leave-types/reorder", {
      orderedIds,
    });
    return response.data;
  },
};
