import { api } from "@/lib/api";
import { Leave, CreateLeaveDto, LeaveType, LeaveStatus } from "@/types";

export interface LeaveBalance {
  userId: string;
  year: number;
  total: number;
  used: number;
  available: number;
  pending: number;
  byType: LeaveBalanceByType[];
}

export interface LeaveBalanceByType {
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  leaveTypeColor: string;
  leaveTypeIcon: string;
  year: number;
  total: number;
  used: number;
  pending: number;
  available: number;
}

export interface LeaveBalanceRecord {
  id: string;
  userId: string | null;
  leaveTypeId: string;
  year: number;
  totalDays: number;
  createdAt: string;
  updatedAt: string;
  leaveType: {
    id: string;
    code: string;
    name: string;
    color: string;
    icon: string;
  };
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface UpsertLeaveBalanceDto {
  userId?: string;
  leaveTypeId: string;
  year: number;
  totalDays: number;
}

export interface LeaveValidationDelegate {
  id: string;
  delegatorId: string;
  delegateId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  delegator?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  delegate?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
}

interface LeavesResponse {
  data: Leave[];
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

export const leavesService = {
  async getAll(
    page = 1,
    limit = 100,
    userId?: string,
    status?: LeaveStatus,
    type?: LeaveType,
  ): Promise<LeavesResponse> {
    let url = `/leaves?page=${page}&limit=${limit}`;
    if (userId) url += `&userId=${userId}`;
    if (status) url += `&status=${status}`;
    if (type) url += `&type=${type}`;
    const response = await api.get<LeavesResponse>(url);
    return response.data;
  },

  async getById(id: string): Promise<Leave> {
    const response = await api.get<Leave>(`/leaves/${id}`);
    return response.data;
  },

  async getByUser(userId: string): Promise<Leave[]> {
    const response = await api.get<Leave[]>(`/leaves/user/${userId}`);
    return response.data;
  },

  async getMyLeaves(): Promise<Leave[]> {
    const response = await api.get<Leave[]>("/leaves/me");
    return response.data;
  },

  async getPendingForValidation(): Promise<Leave[]> {
    const response = await api.get<Leave[]>("/leaves/pending-validation");
    return response.data;
  },

  async getByType(type: LeaveType): Promise<Leave[]> {
    const response = await api.get<Leave[]>(`/leaves/type/${type}`);
    return response.data;
  },

  async getByStatus(status: LeaveStatus): Promise<Leave[]> {
    const response = await api.get<Leave[]>(`/leaves/status/${status}`);
    return response.data;
  },

  async getByDateRange(startDate: string, endDate: string): Promise<Leave[]> {
    // Passer limit=1000 pour éviter la troncature par la pagination par défaut (10).
    // L'API retourne un tableau brut (non paginé) quand startDate ou endDate est fourni.
    const response = await api.get<Leave[]>(
      `/leaves?startDate=${startDate}&endDate=${endDate}&limit=1000`,
    );
    return response.data;
  },

  async create(
    data: CreateLeaveDto & { targetUserId?: string },
  ): Promise<Leave> {
    const response = await api.post<Leave>("/leaves", data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateLeaveDto>): Promise<Leave> {
    const response = await api.patch<Leave>(`/leaves/${id}`, data);
    return response.data;
  },

  async updateStatus(id: string, status: LeaveStatus): Promise<Leave> {
    const response = await api.patch<Leave>(`/leaves/${id}/status`, { status });
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/leaves/${id}`);
  },

  async getBalance(userId: string): Promise<LeaveBalance> {
    const response = await api.get<LeaveBalance>(`/leaves/balance/${userId}`);
    return response.data;
  },

  async getMyBalance(): Promise<LeaveBalance> {
    const response = await api.get<LeaveBalance>("/leaves/me/balance");
    return response.data;
  },

  // ===========================
  // GESTION DES SOLDES
  // ===========================

  async getBalances(
    year?: number,
    userId?: string,
  ): Promise<LeaveBalanceRecord[]> {
    let url = "/leaves/balances";
    const params: string[] = [];
    if (year) params.push(`year=${year}`);
    if (userId !== undefined) params.push(`userId=${userId}`);
    if (params.length) url += `?${params.join("&")}`;
    const response = await api.get<LeaveBalanceRecord[]>(url);
    return response.data;
  },

  async getDefaultBalances(year?: number): Promise<LeaveBalanceRecord[]> {
    let url = "/leaves/balances/defaults";
    if (year) url += `?year=${year}`;
    const response = await api.get<LeaveBalanceRecord[]>(url);
    return response.data;
  },

  async upsertBalance(
    data: UpsertLeaveBalanceDto,
  ): Promise<LeaveBalanceRecord> {
    const response = await api.post<LeaveBalanceRecord>(
      "/leaves/balances",
      data,
    );
    return response.data;
  },

  async deleteBalance(id: string): Promise<void> {
    await api.delete(`/leaves/balances/${id}`);
  },

  async approve(id: string, comment?: string): Promise<Leave> {
    const response = await api.post<Leave>(`/leaves/${id}/approve`, {
      comment,
    });
    return response.data;
  },

  async reject(id: string, reason?: string): Promise<Leave> {
    const response = await api.post<Leave>(`/leaves/${id}/reject`, { reason });
    return response.data;
  },

  async cancel(id: string): Promise<Leave> {
    const response = await api.post<Leave>(`/leaves/${id}/cancel`);
    return response.data;
  },

  // Gestion des délégations
  async createDelegation(
    delegateId: string,
    startDate: string,
    endDate: string,
  ): Promise<LeaveValidationDelegate> {
    const response = await api.post<LeaveValidationDelegate>(
      "/leaves/delegations",
      {
        delegateId,
        startDate,
        endDate,
      },
    );
    return response.data;
  },

  async getMyDelegations(): Promise<{
    given: LeaveValidationDelegate[];
    received: LeaveValidationDelegate[];
  }> {
    const response = await api.get<{
      given: LeaveValidationDelegate[];
      received: LeaveValidationDelegate[];
    }>("/leaves/delegations/me");
    return response.data;
  },

  async deactivateDelegation(id: string): Promise<void> {
    await api.delete(`/leaves/delegations/${id}`);
  },

  // Import CSV
  async getImportTemplate(): Promise<string> {
    const response = await api.get<{ template: string }>(
      "/leaves/import-template",
    );
    return response.data.template;
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async validateImport(leaves: any[]): Promise<any> {
    const response = await api.post("/leaves/import/validate", { leaves });
    return response.data;
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async importLeaves(leaves: any[]): Promise<{
    created: number;
    skipped: number;
    errors: number;
    errorDetails: string[];
  }> {
    const response = await api.post("/leaves/import", { leaves });
    return response.data;
  },
};
