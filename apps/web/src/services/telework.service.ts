import { api } from "@/lib/api";
import {
  TeleworkSchedule,
  CreateTeleworkDto,
  TeleworkRecurringRule,
  CreateRecurringRuleDto,
  UpdateRecurringRuleDto,
  GenerateSchedulesDto,
} from "@/types";

export const teleworkService = {
  async getAll(): Promise<TeleworkSchedule[]> {
    const response = await api.get<
      { data: TeleworkSchedule[] } | TeleworkSchedule[]
    >("/telework");
    // API returns {data: [], meta: {}} - extract the array
    if (response.data && "data" in response.data) {
      return response.data.data;
    }
    return Array.isArray(response.data) ? response.data : [];
  },

  async getByUser(userId: string): Promise<TeleworkSchedule[]> {
    const response = await api.get<TeleworkSchedule[]>(
      `/telework/user/${userId}`,
    );
    return response.data;
  },

  async getByDateRange(
    startDate: string,
    endDate: string,
    userId?: string,
  ): Promise<TeleworkSchedule[]> {
    const params = new URLSearchParams({ startDate, endDate });
    if (userId) params.set("userId", userId);
    const response = await api.get<
      { data: TeleworkSchedule[] } | TeleworkSchedule[]
    >(`/telework?${params.toString()}`);
    // API returns {data: [], meta: {}} - extract the array
    if (response.data && "data" in response.data) {
      return response.data.data;
    }
    return Array.isArray(response.data) ? response.data : [];
  },

  async create(data: CreateTeleworkDto): Promise<TeleworkSchedule> {
    const response = await api.post<TeleworkSchedule>("/telework", data);
    return response.data;
  },

  async update(
    id: string,
    data: Partial<CreateTeleworkDto>,
  ): Promise<TeleworkSchedule> {
    const response = await api.patch<TeleworkSchedule>(`/telework/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/telework/${id}`);
  },

  // ─────────────────────────────────────────────
  // RECURRING RULES
  // ─────────────────────────────────────────────

  async getRecurringRules(userId?: string): Promise<TeleworkRecurringRule[]> {
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await api.get<TeleworkRecurringRule[]>(
      `/telework/recurring-rules${query}`,
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async createRecurringRule(
    data: CreateRecurringRuleDto,
  ): Promise<TeleworkRecurringRule> {
    const response = await api.post<TeleworkRecurringRule>(
      "/telework/recurring-rules",
      data,
    );
    return response.data;
  },

  async updateRecurringRule(
    id: string,
    data: UpdateRecurringRuleDto,
  ): Promise<TeleworkRecurringRule> {
    const response = await api.patch<TeleworkRecurringRule>(
      `/telework/recurring-rules/${id}`,
      data,
    );
    return response.data;
  },

  async deleteRecurringRule(id: string): Promise<void> {
    await api.delete(`/telework/recurring-rules/${id}`);
  },

  async generateSchedules(data: GenerateSchedulesDto): Promise<{
    message: string;
    created: number;
    skipped: number;
    rulesProcessed: number;
  }> {
    const response = await api.post<{
      message: string;
      created: number;
      skipped: number;
      rulesProcessed: number;
    }>("/telework/recurring-rules/generate", data);
    return response.data;
  },
};
