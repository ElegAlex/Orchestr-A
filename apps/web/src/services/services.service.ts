import { api } from '@/lib/api';
import { Service, CreateServiceDto } from '@/types';

export const servicesService = {
  async getAll(): Promise<Service[]> {
    const response = await api.get<any>('/services');
    // API returns {data: [], meta: {}} - extract the array
    if (response.data && 'data' in response.data) {
      return response.data.data;
    }
    return Array.isArray(response.data) ? response.data : [];
  },

  async getById(id: string): Promise<Service> {
    const response = await api.get<Service>(`/services/${id}`);
    return response.data;
  },

  async getByDepartment(departmentId: string): Promise<Service[]> {
    const response = await api.get<Service[]>(`/services/department/${departmentId}`);
    return response.data;
  },

  async create(data: CreateServiceDto): Promise<Service> {
    const response = await api.post<Service>('/services', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateServiceDto>): Promise<Service> {
    const response = await api.patch<Service>(`/services/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/services/${id}`);
  },

  async getMembers(id: string): Promise<any[]> {
    const response = await api.get<any[]>(`/services/${id}/members`);
    return response.data;
  },
};
