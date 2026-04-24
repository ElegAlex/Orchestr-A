import { api } from "@/lib/api";

// ===========================
// TYPES
// ===========================

export type TaskDuration = "HALF_DAY" | "FULL_DAY" | "TIME_SLOT";
export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type RecurrenceType = "WEEKLY" | "MONTHLY_DAY" | "MONTHLY_ORDINAL";

export interface PredefinedTask {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  icon: string;
  defaultDuration: TaskDuration;
  startTime?: string | null; // Format "HH:mm"
  endTime?: string | null; // Format "HH:mm"
  isExternalIntervention: boolean;
  isActive: boolean;
  weight: number; // 1..5, pondération pour équilibrage
  createdAt: string;
  updatedAt: string;
}

export interface PredefinedTaskAssignment {
  id: string;
  predefinedTaskId: string;
  userId: string;
  date: string;
  period: AssignmentPeriod;
  note?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  predefinedTask?: PredefinedTask;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface PredefinedTaskRecurringRule {
  id: string;
  predefinedTaskId: string;
  userId: string;
  recurrenceType?: RecurrenceType;
  dayOfWeek: DayOfWeek | null;
  monthlyDayOfMonth?: number | null;
  monthlyOrdinal?: number | null;
  period: TaskDuration;
  weekInterval: number;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  predefinedTask?: PredefinedTask;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

// ===========================
// DTOs
// ===========================

export interface CreatePredefinedTaskDto {
  name: string;
  description?: string;
  color: string;
  icon: string;
  defaultDuration: TaskDuration;
  startTime?: string;
  endTime?: string;
  isExternalIntervention?: boolean;
  weight?: number; // 1..5, défaut 1 côté API
}

export interface UpdatePredefinedTaskDto {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  defaultDuration?: TaskDuration;
  startTime?: string;
  endTime?: string;
  isExternalIntervention?: boolean;
  isActive?: boolean;
  weight?: number; // 1..5
}

export type AssignmentPeriod = "MORNING" | "AFTERNOON" | "FULL_DAY";

export interface CreateAssignmentDto {
  predefinedTaskId: string;
  userId: string;
  date: string;
  period: AssignmentPeriod;
  note?: string;
}

export interface BulkAssignmentDto {
  predefinedTaskId: string;
  userIds: string[];
  dates: string[];
  period: AssignmentPeriod;
  note?: string;
}

export interface CreateRecurringRuleDto {
  predefinedTaskId: string;
  userId: string;
  recurrenceType?: RecurrenceType;
  dayOfWeek?: DayOfWeek | null;
  monthlyDayOfMonth?: number | null;
  monthlyOrdinal?: number | null;
  period: TaskDuration;
  weekInterval?: number | null;
  startDate: string;
  endDate?: string;
}

export interface UpdateRecurringRuleDto {
  recurrenceType?: RecurrenceType;
  dayOfWeek?: DayOfWeek | null;
  monthlyDayOfMonth?: number | null;
  monthlyOrdinal?: number | null;
  period?: TaskDuration;
  weekInterval?: number | null;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

export interface GenerateAssignmentsDto {
  startDate: string;
  endDate: string;
  ruleId?: string;
}

export interface BulkCreateRecurringRulesDto {
  predefinedTaskId: string;
  userIds: string[];
  daysOfWeek: DayOfWeek[];
  period: TaskDuration;
  weekInterval?: number;
  startDate: string;
  endDate?: string;
  recurrenceType?: RecurrenceType;
}

export interface BulkCreateRecurringRulesResponse {
  created: number;
  rules: PredefinedTaskRecurringRule[];
}

interface PredefinedTasksResponse {
  data: PredefinedTask[];
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

interface AssignmentsResponse {
  data: PredefinedTaskAssignment[];
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

// ===========================
// SERVICE
// ===========================

export const predefinedTasksService = {
  // --- Tâches prédéfinies ---

  async getAll(page = 1, limit = 100): Promise<PredefinedTasksResponse> {
    const response = await api.get<PredefinedTasksResponse>(
      `/predefined-tasks?page=${page}&limit=${limit}`,
    );
    return response.data;
  },

  async getById(id: string): Promise<PredefinedTask> {
    const response = await api.get<PredefinedTask>(`/predefined-tasks/${id}`);
    return response.data;
  },

  async create(data: CreatePredefinedTaskDto): Promise<PredefinedTask> {
    const response = await api.post<PredefinedTask>("/predefined-tasks", data);
    return response.data;
  },

  async update(
    id: string,
    data: UpdatePredefinedTaskDto,
  ): Promise<PredefinedTask> {
    const response = await api.patch<PredefinedTask>(
      `/predefined-tasks/${id}`,
      data,
    );
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/predefined-tasks/${id}`);
  },

  // --- Assignations ---

  async getAssignments(params?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    predefinedTaskId?: string;
    page?: number;
    limit?: number;
  }): Promise<AssignmentsResponse> {
    const query = new URLSearchParams();
    if (params?.userId) query.set("userId", params.userId);
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    if (params?.predefinedTaskId)
      query.set("predefinedTaskId", params.predefinedTaskId);
    query.set("page", String(params?.page ?? 1));
    query.set("limit", String(params?.limit ?? 200));

    const response = await api.get<AssignmentsResponse>(
      `/predefined-tasks/assignments?${query.toString()}`,
    );
    return response.data;
  },

  async createAssignment(
    data: CreateAssignmentDto,
  ): Promise<PredefinedTaskAssignment> {
    const response = await api.post<PredefinedTaskAssignment>(
      "/predefined-tasks/assignments",
      data,
    );
    return response.data;
  },

  async bulkAssign(
    data: BulkAssignmentDto,
  ): Promise<PredefinedTaskAssignment[]> {
    const response = await api.post<PredefinedTaskAssignment[]>(
      "/predefined-tasks/assignments/bulk",
      data,
    );
    return response.data;
  },

  async deleteAssignment(id: string): Promise<void> {
    await api.delete(`/predefined-tasks/assignments/${id}`);
  },

  // --- Règles récurrentes ---

  async getRecurringRules(params?: {
    userId?: string;
    predefinedTaskId?: string;
    isActive?: boolean;
  }): Promise<PredefinedTaskRecurringRule[]> {
    const query = new URLSearchParams();
    if (params?.userId) query.set("userId", params.userId);
    if (params?.predefinedTaskId)
      query.set("predefinedTaskId", params.predefinedTaskId);
    if (params?.isActive !== undefined)
      query.set("isActive", String(params.isActive));

    const response = await api.get<PredefinedTaskRecurringRule[]>(
      `/predefined-tasks/recurring-rules?${query.toString()}`,
    );
    return response.data;
  },

  async createRecurringRule(
    data: CreateRecurringRuleDto,
  ): Promise<PredefinedTaskRecurringRule> {
    const response = await api.post<PredefinedTaskRecurringRule>(
      "/predefined-tasks/recurring-rules",
      data,
    );
    return response.data;
  },

  async bulkCreateRecurringRules(
    data: BulkCreateRecurringRulesDto,
  ): Promise<BulkCreateRecurringRulesResponse> {
    const response = await api.post<BulkCreateRecurringRulesResponse>(
      "/predefined-tasks/recurring-rules/bulk",
      data,
    );
    return response.data;
  },

  async updateRecurringRule(
    id: string,
    data: UpdateRecurringRuleDto,
  ): Promise<PredefinedTaskRecurringRule> {
    const response = await api.patch<PredefinedTaskRecurringRule>(
      `/predefined-tasks/recurring-rules/${id}`,
      data,
    );
    return response.data;
  },

  async deleteRecurringRule(id: string): Promise<void> {
    await api.delete(`/predefined-tasks/recurring-rules/${id}`);
  },

  async generateAssignments(
    data: GenerateAssignmentsDto,
  ): Promise<PredefinedTaskAssignment[]> {
    const response = await api.post<PredefinedTaskAssignment[]>(
      "/predefined-tasks/recurring-rules/generate",
      data,
    );
    return response.data;
  },
};
