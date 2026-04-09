import { api } from "@/lib/api";
import {
  SchoolVacation,
  CreateSchoolVacationDto,
  UpdateSchoolVacationDto,
  ImportSchoolVacationResult,
} from "@/types";

export const schoolVacationsService = {
  async getAll(year?: number): Promise<SchoolVacation[]> {
    const url = year ? `/school-vacations?year=${year}` : "/school-vacations";
    const response = await api.get<SchoolVacation[]>(url);
    return response.data;
  },

  async getByRange(startDate: string, endDate: string): Promise<SchoolVacation[]> {
    const response = await api.get<SchoolVacation[]>(
      `/school-vacations/range?startDate=${startDate}&endDate=${endDate}`,
    );
    return response.data;
  },

  async getById(id: string): Promise<SchoolVacation> {
    const response = await api.get<SchoolVacation>(`/school-vacations/${id}`);
    return response.data;
  },

  async create(data: CreateSchoolVacationDto): Promise<SchoolVacation> {
    const response = await api.post<SchoolVacation>("/school-vacations", data);
    return response.data;
  },

  async update(id: string, data: UpdateSchoolVacationDto): Promise<SchoolVacation> {
    const response = await api.patch<SchoolVacation>(`/school-vacations/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/school-vacations/${id}`);
  },

  async importFromOpenData(year: number): Promise<ImportSchoolVacationResult> {
    const response = await api.post<ImportSchoolVacationResult>(
      "/school-vacations/import",
      { year },
    );
    return response.data;
  },
};
