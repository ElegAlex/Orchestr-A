import { api } from '@/lib/api';
import { TeleworkSchedule, CreateTeleworkDto } from '@/types';

export const teleworkService = {
  async getAll(): Promise<TeleworkSchedule[]> {
    const response = await api.get<any>('/telework');
    // API returns {data: [], meta: {}} - extract the array
    if (response.data && 'data' in response.data) {
      return response.data.data;
    }
    return Array.isArray(response.data) ? response.data : [];
  },

  async getByUser(userId: string): Promise<TeleworkSchedule[]> {
    const response = await api.get<TeleworkSchedule[]>(`/telework/user/${userId}`);
    return response.data;
  },

  async getByDateRange(startDate: string, endDate: string): Promise<TeleworkSchedule[]> {
    const response = await api.get<any>(
      `/telework?startDate=${startDate}&endDate=${endDate}`
    );
    // API returns {data: [], meta: {}} - extract the array
    if (response.data && 'data' in response.data) {
      return response.data.data;
    }
    return Array.isArray(response.data) ? response.data : [];
  },

  async create(data: CreateTeleworkDto): Promise<TeleworkSchedule> {
    const response = await api.post<TeleworkSchedule>('/telework', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateTeleworkDto>): Promise<TeleworkSchedule> {
    const response = await api.patch<TeleworkSchedule>(`/telework/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/telework/${id}`);
  },
};
