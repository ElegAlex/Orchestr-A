import { api } from '@/lib/api';
import {
  Holiday,
  CreateHolidayDto,
  UpdateHolidayDto,
  ImportFrenchHolidaysResult,
} from '@/types';

export const holidaysService = {
  /**
   * Recupere tous les jours feries
   */
  async getAll(): Promise<Holiday[]> {
    const response = await api.get<Holiday[]>('/holidays');
    return response.data;
  },

  /**
   * Recupere les jours feries d'une annee
   */
  async getByYear(year: number): Promise<Holiday[]> {
    const response = await api.get<Holiday[]>(`/holidays/year/${year}`);
    return response.data;
  },

  /**
   * Recupere les jours feries sur une periode
   */
  async getByRange(startDate: string, endDate: string): Promise<Holiday[]> {
    const response = await api.get<Holiday[]>(
      `/holidays/range?startDate=${startDate}&endDate=${endDate}`
    );
    return response.data;
  },

  /**
   * Recupere un jour ferie par ID
   */
  async getById(id: string): Promise<Holiday> {
    const response = await api.get<Holiday>(`/holidays/${id}`);
    return response.data;
  },

  /**
   * Cree un nouveau jour ferie
   */
  async create(data: CreateHolidayDto): Promise<Holiday> {
    const response = await api.post<Holiday>('/holidays', data);
    return response.data;
  },

  /**
   * Met a jour un jour ferie
   */
  async update(id: string, data: UpdateHolidayDto): Promise<Holiday> {
    const response = await api.patch<Holiday>(`/holidays/${id}`, data);
    return response.data;
  },

  /**
   * Supprime un jour ferie
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/holidays/${id}`);
  },

  /**
   * Importe les jours feries francais pour une annee
   */
  async importFrench(year?: number): Promise<ImportFrenchHolidaysResult> {
    const url = year
      ? `/holidays/import-french?year=${year}`
      : '/holidays/import-french';
    const response = await api.post<ImportFrenchHolidaysResult>(url);
    return response.data;
  },

  /**
   * Compte le nombre de jours ouvres entre deux dates
   */
  async countWorkingDays(
    startDate: string,
    endDate: string
  ): Promise<{ workingDays: number }> {
    const response = await api.get<{ workingDays: number }>(
      `/holidays/working-days/count?startDate=${startDate}&endDate=${endDate}`
    );
    return response.data;
  },
};
