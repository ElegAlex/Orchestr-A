import { api } from '@/lib/api';

export interface AppSetting {
  id: string;
  key: string;
  value: unknown;
  category: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsResponse {
  settings: Record<string, unknown>;
  list: AppSetting[];
}

export const settingsService = {
  async getAll(): Promise<SettingsResponse> {
    const response = await api.get<SettingsResponse>('/settings');
    return response.data;
  },

  async getByCategory(category: string): Promise<AppSetting[]> {
    const response = await api.get<AppSetting[]>(`/settings/category/${category}`);
    return response.data;
  },

  async getOne(key: string): Promise<AppSetting | null> {
    const response = await api.get<AppSetting>(`/settings/${key}`);
    return response.data;
  },

  async update(key: string, value: unknown, description?: string): Promise<AppSetting> {
    const response = await api.put<AppSetting>(`/settings/${key}`, {
      value: JSON.stringify(value),
      description,
    });
    return response.data;
  },

  async bulkUpdate(settings: Record<string, unknown>): Promise<AppSetting[]> {
    const response = await api.post<AppSetting[]>('/settings/bulk', { settings });
    return response.data;
  },

  async resetToDefault(key: string): Promise<AppSetting> {
    const response = await api.post<AppSetting>(`/settings/${key}/reset`);
    return response.data;
  },

  async resetAllToDefaults(): Promise<SettingsResponse> {
    const response = await api.post<SettingsResponse>('/settings/reset-all');
    return response.data;
  },
};
