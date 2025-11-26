import { api } from '@/lib/api';
import { Leave, CreateLeaveDto, LeaveType, LeaveStatus } from '@/types';

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

export const leavesService = {
  async getAll(page = 1, limit = 100, userId?: string, status?: LeaveStatus, type?: LeaveType): Promise<any> {
    let url = `/leaves?page=${page}&limit=${limit}`;
    if (userId) url += `&userId=${userId}`;
    if (status) url += `&status=${status}`;
    if (type) url += `&type=${type}`;
    const response = await api.get<any>(url);
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
    const response = await api.get<Leave[]>('/leaves/me');
    return response.data;
  },

  async getPendingForValidation(): Promise<Leave[]> {
    const response = await api.get<Leave[]>('/leaves/pending-validation');
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
    const response = await api.get<Leave[]>(
      `/leaves?startDate=${startDate}&endDate=${endDate}`
    );
    return response.data;
  },

  async create(data: CreateLeaveDto): Promise<Leave> {
    const response = await api.post<Leave>('/leaves', data);
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

  async getBalance(userId: string): Promise<any> {
    const response = await api.get(`/leaves/balance/${userId}`);
    return response.data;
  },

  async getMyBalance(): Promise<any> {
    const response = await api.get('/leaves/me/balance');
    return response.data;
  },

  async approve(id: string, comment?: string): Promise<Leave> {
    const response = await api.post<Leave>(`/leaves/${id}/approve`, { comment });
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
  async createDelegation(delegateId: string, startDate: string, endDate: string): Promise<LeaveValidationDelegate> {
    const response = await api.post<LeaveValidationDelegate>('/leaves/delegations', {
      delegateId,
      startDate,
      endDate,
    });
    return response.data;
  },

  async getMyDelegations(): Promise<{ given: LeaveValidationDelegate[]; received: LeaveValidationDelegate[] }> {
    const response = await api.get<{ given: LeaveValidationDelegate[]; received: LeaveValidationDelegate[] }>('/leaves/delegations/me');
    return response.data;
  },

  async deactivateDelegation(id: string): Promise<void> {
    await api.delete(`/leaves/delegations/${id}`);
  },
};
