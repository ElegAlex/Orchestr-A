import { api } from '@/lib/api';
import { Leave, CreateLeaveDto, LeaveType, LeaveStatus } from '@/types';

export const leavesService = {
  async getAll(): Promise<Leave[]> {
    const response = await api.get<any>('/leaves');
    // API returns {data: [], meta: {}} - extract the array
    if (response.data && 'data' in response.data) {
      return response.data.data;
    }
    return Array.isArray(response.data) ? response.data : [];
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
    const response = await api.get(`/leaves/user/${userId}/balance`);
    return response.data;
  },
};
