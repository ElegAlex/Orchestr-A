import { api } from "@/lib/api";
import { Milestone, PaginatedResponse } from "@/types";

export const milestonesService = {
  async getAll(): Promise<PaginatedResponse<Milestone>> {
    const response = await api.get<PaginatedResponse<Milestone>>("/milestones");
    return response.data;
  },

  async getById(id: string): Promise<Milestone> {
    const response = await api.get<Milestone>(`/milestones/${id}`);
    return response.data;
  },

  async getByProject(projectId: string): Promise<Milestone[]> {
    const response = await api.get<Milestone[]>(
      `/milestones/project/${projectId}`,
    );
    return response.data;
  },

  async create(data: {
    name: string;
    description?: string;
    dueDate: string;
    projectId: string;
  }): Promise<Milestone> {
    const response = await api.post<Milestone>("/milestones", data);
    return response.data;
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      description?: string;
      dueDate: string;
      status: string;
    }>,
  ): Promise<Milestone> {
    const response = await api.patch<Milestone>(`/milestones/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/milestones/${id}`);
  },

  async getImportTemplate(projectId: string): Promise<string> {
    const response = await api.get<{ template: string }>(
      `/milestones/project/${projectId}/import-template`,
    );
    return response.data.template;
  },

  async validateImport(
    projectId: string,
    milestones: Array<{
      name: string;
      description?: string;
      dueDate: string;
    }>,
  ): Promise<MilestonesValidationPreview> {
    const response = await api.post<MilestonesValidationPreview>(
      `/milestones/project/${projectId}/import/validate`,
      { milestones },
    );
    return response.data;
  },

  async importMilestones(
    projectId: string,
    milestones: Array<{
      name: string;
      description?: string;
      dueDate: string;
    }>,
  ): Promise<{
    created: number;
    skipped: number;
    errors: number;
    errorDetails: string[];
  }> {
    const response = await api.post<{
      created: number;
      skipped: number;
      errors: number;
      errorDetails: string[];
    }>(`/milestones/project/${projectId}/import`, { milestones });
    return response.data;
  },
};

// Types pour la prévisualisation d'import
export interface MilestonePreviewItem {
  lineNumber: number;
  milestone: {
    name: string;
    description?: string;
    dueDate: string;
  };
  status: "valid" | "duplicate" | "error" | "warning";
  messages: string[];
}

export interface MilestonesValidationPreview {
  valid: MilestonePreviewItem[];
  duplicates: MilestonePreviewItem[];
  errors: MilestonePreviewItem[];
  warnings: MilestonePreviewItem[];
  summary: {
    total: number;
    valid: number;
    duplicates: number;
    errors: number;
    warnings: number;
  };
}
