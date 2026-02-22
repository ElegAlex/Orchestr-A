import { api } from "@/lib/api";
import { Service, CreateServiceDto, User } from "@/types";

export const servicesService = {
  async getAll(): Promise<Service[]> {
    const response = await api.get<{ data: Service[] } | Service[]>(
      "/services",
    );
    // API returns {data: [], meta: {}} - extract the array
    if (response.data && "data" in response.data) {
      return response.data.data;
    }
    return Array.isArray(response.data) ? response.data : [];
  },

  async getById(id: string): Promise<Service> {
    const response = await api.get<Service>(`/services/${id}`);
    return response.data;
  },

  async getByDepartment(departmentId: string): Promise<Service[]> {
    const response = await api.get<Service[]>(
      `/services/department/${departmentId}`,
    );
    return response.data;
  },

  async create(data: CreateServiceDto): Promise<Service> {
    const response = await api.post<Service>("/services", data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateServiceDto>): Promise<Service> {
    const response = await api.patch<Service>(`/services/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/services/${id}`);
  },

  async getMembers(id: string): Promise<User[]> {
    const response = await api.get<User[]>(`/services/${id}/members`);
    return response.data;
  },

  async getAllWithMemberCounts(): Promise<{ services: Service[]; memberCounts: Record<string, number> }> {
    const services = await this.getAll();
    const memberCounts: Record<string, number> = {};
    await Promise.all(
      services.map(async (service) => {
        try {
          const members = await this.getMembers(service.id);
          memberCounts[service.id] = members.length;
        } catch {
          memberCounts[service.id] = 0;
        }
      }),
    );
    return { services, memberCounts };
  },
};
