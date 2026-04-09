import { api } from "@/lib/api";
import {
  SchoolVacation,
  CreateSchoolVacationDto,
  UpdateSchoolVacationDto,
  ImportSchoolVacationResult,
} from "@/types";

export const schoolVacationsService = {
  /**
   * Recupere toutes les vacances scolaires
   */
  async getAll(year?: number): Promise<SchoolVacation[]> {
    const url = year ? `/school-vacations?year=${year}` : "/school-vacations";
    const response = await api.get<SchoolVacation[]>(url);
    return response.data;
  },

  /**
   * Recupere les vacances scolaires sur une periode
   */
  async getByRange(startDate: string, endDate: string): Promise<SchoolVacation[]> {
    const response = await api.get<SchoolVacation[]>(
      `/school-vacations/range?startDate=${startDate}&endDate=${endDate}`,
    );
    return response.data;
  },

  /**
   * Recupere une vacance scolaire par ID
   */
  async getById(id: string): Promise<SchoolVacation> {
    const response = await api.get<SchoolVacation>(`/school-vacations/${id}`);
    return response.data;
  },

  /**
   * Cree une nouvelle vacance scolaire
   */
  async create(data: CreateSchoolVacationDto): Promise<SchoolVacation> {
    const response = await api.post<SchoolVacation>("/school-vacations", data);
    return response.data;
  },

  /**
   * Met a jour une vacance scolaire
   */
  async update(id: string, data: UpdateSchoolVacationDto): Promise<SchoolVacation> {
    const response = await api.patch<SchoolVacation>(`/school-vacations/${id}`, data);
    return response.data;
  },

  /**
   * Supprime une vacance scolaire
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/school-vacations/${id}`);
  },

  /**
   * Importe les vacances scolaires depuis l'Open Data
   */
  async importFromOpenData(year?: number): Promise<ImportSchoolVacationResult> {
    const url = year
      ? `/school-vacations/import?year=${year}`
      : "/school-vacations/import";
    const response = await api.post<ImportSchoolVacationResult>(url);
    return response.data;
  },
};
