import { api } from '@/lib/api';
import { User, PaginatedResponse, Role } from '@/types';

export const usersService = {
  async getAll(
    page?: number,
    limit?: number,
    role?: Role
  ): Promise<User[] | PaginatedResponse<User>> {
    const params = new URLSearchParams();
    if (page !== undefined) params.append('page', page.toString());
    if (limit !== undefined) params.append('limit', limit.toString());
    if (role) params.append('role', role);

    const response = await api.get<any>(
      `/users?${params.toString()}`
    );
    // API returns {data: [], meta: {}} - extract based on usage
    if (response.data && 'data' in response.data) {
      // Si pas de pagination demandée, retourner le tableau directement
      if (page === undefined) {
        return response.data.data as User[];
      }
      return response.data as PaginatedResponse<User>;
    }
    // Fallback for direct array response
    return Array.isArray(response.data) ? response.data : [];
  },

  async getById(id: string): Promise<User> {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  },

  async getByDepartment(departmentId: string): Promise<User[]> {
    const response = await api.get<User[]>(`/users/department/${departmentId}`);
    return response.data;
  },

  async getByService(serviceId: string): Promise<User[]> {
    const response = await api.get<User[]>(`/users/service/${serviceId}`);
    return response.data;
  },

  async getByRole(role: Role): Promise<User[]> {
    const response = await api.get<User[]>(`/users/role/${role}`);
    return response.data;
  },

  async create(data: any): Promise<User> {
    const response = await api.post<User>('/users', data);
    return response.data;
  },

  async update(id: string, data: any): Promise<User> {
    const response = await api.patch<User>(`/users/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    await api.patch('/users/me/change-password', data);
  },

  async resetPassword(id: string, newPassword: string): Promise<void> {
    await api.post(`/users/${id}/reset-password`, { newPassword });
  },
};
