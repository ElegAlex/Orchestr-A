import { api } from '@/lib/api';
import { TimeEntry, CreateTimeEntryDto, ActivityType } from '@/types';

export const timeTrackingService = {
  async getAll(): Promise<TimeEntry[]> {
    const response = await api.get<any>('/time-tracking');
    // API returns {data: [], meta: {}} - extract the array
    if (response.data && 'data' in response.data) {
      return response.data.data;
    }
    return Array.isArray(response.data) ? response.data : [];
  },

  async getById(id: string): Promise<TimeEntry> {
    const response = await api.get<TimeEntry>(`/time-tracking/${id}`);
    return response.data;
  },

  async getByUser(userId: string, startDate?: string, endDate?: string): Promise<TimeEntry[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get<TimeEntry[]>(
      `/time-tracking/user/${userId}?${params.toString()}`
    );
    return response.data;
  },

  async getMyEntries(startDate?: string, endDate?: string): Promise<TimeEntry[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get<TimeEntry[]>(
      `/time-tracking/me?${params.toString()}`
    );
    return response.data;
  },

  async getByProject(projectId: string, startDate?: string, endDate?: string): Promise<TimeEntry[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get<TimeEntry[]>(
      `/time-tracking/project/${projectId}?${params.toString()}`
    );
    return response.data;
  },

  async getByTask(taskId: string): Promise<TimeEntry[]> {
    const response = await api.get<TimeEntry[]>(`/time-tracking/task/${taskId}`);
    return response.data;
  },

  async create(data: CreateTimeEntryDto): Promise<TimeEntry> {
    const response = await api.post<TimeEntry>('/time-tracking', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateTimeEntryDto>): Promise<TimeEntry> {
    const response = await api.patch<TimeEntry>(`/time-tracking/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/time-tracking/${id}`);
  },

  async getStats(userId: string, startDate?: string, endDate?: string): Promise<any> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get(
      `/time-tracking/user/${userId}/stats?${params.toString()}`
    );
    return response.data;
  },
};
