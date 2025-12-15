import { api } from '@/lib/api';
import { Department, CreateDepartmentDto } from '@/types';

export const departmentsService = {
  async getAll(): Promise<Department[]> {
    const response = await api.get<any>('/departments');
    // API returns {data: [], meta: {}} - extract the array
    if (response.data && 'data' in response.data) {
      return response.data.data;
    }
    return Array.isArray(response.data) ? response.data : [];
  },

  async getById(id: string): Promise<Department> {
    const response = await api.get<Department>(`/departments/${id}`);
    return response.data;
  },

  async create(data: CreateDepartmentDto): Promise<Department> {
    const response = await api.post<Department>('/departments', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateDepartmentDto>): Promise<Department> {
    const response = await api.patch<Department>(`/departments/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/departments/${id}`);
  },

  async getStats(id: string): Promise<{
    servicesCount: number;
    membersCount: number;
  }> {
    const response = await api.get<{
      servicesCount: number;
      membersCount: number;
    }>(`/departments/${id}/stats`);
    return response.data;
  },
};
