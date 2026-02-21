import { api } from "@/lib/api";
import { User, PaginatedResponse, Role } from "@/types";

export const usersService = {
  async getAll(
    page?: number,
    limit?: number,
    role?: Role,
  ): Promise<User[] | PaginatedResponse<User>> {
    const params = new URLSearchParams();
    if (page !== undefined) params.append("page", page.toString());
    if (limit !== undefined) params.append("limit", limit.toString());
    if (role) params.append("role", role);

    const response = await api.get<PaginatedResponse<User> | User[]>(
      `/users?${params.toString()}`,
    );
    // API returns {data: [], meta: {}} - extract based on usage
    if (response.data && "data" in response.data) {
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

  async create(data: Partial<User>): Promise<User> {
    const response = await api.post<User>("/users", data);
    return response.data;
  },

  async update(id: string, data: Partial<User>): Promise<User> {
    const response = await api.patch<User>(`/users/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },

  /**
   * Vérifier les dépendances d'un utilisateur avant suppression définitive
   */
  async checkDependencies(id: string): Promise<UserDependenciesResponse> {
    const response = await api.get<UserDependenciesResponse>(
      `/users/${id}/dependencies`,
    );
    return response.data;
  },

  /**
   * Supprimer définitivement un utilisateur (Admin uniquement)
   */
  async hardDelete(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/users/${id}/hard`,
    );
    return response.data;
  },

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    await api.patch("/users/me/change-password", data);
  },

  async resetPassword(id: string, newPassword: string): Promise<void> {
    await api.post(`/users/${id}/reset-password`, { newPassword });
  },

  async getImportTemplate(): Promise<string> {
    const response = await api.get<string>("/users/import/template");
    return response.data;
  },

  async validateImport(
    users: ImportUserData[],
  ): Promise<UsersValidationPreview> {
    const response = await api.post<UsersValidationPreview>(
      "/users/import/validate",
      { users },
    );
    return response.data;
  },

  async importUsers(users: ImportUserData[]): Promise<ImportUsersResult> {
    const response = await api.post<ImportUsersResult>("/users/import", {
      users,
    });
    return response.data;
  },

  async getPresence(date?: string): Promise<PresenceData> {
    const params = date ? `?date=${date}` : "";
    const response = await api.get<PresenceData>(`/users/presence${params}`);
    return response.data;
  },

  async uploadAvatar(file: File): Promise<User> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<User>("/users/me/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async setAvatarPreset(preset: string): Promise<User> {
    const response = await api.patch<User>("/users/me/avatar/preset", {
      preset,
    });
    return response.data;
  },

  async deleteAvatar(): Promise<User> {
    const response = await api.delete<User>("/users/me/avatar");
    return response.data;
  },
};

export interface ImportUserData {
  email: string;
  login: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  departmentName?: string;
  serviceNames?: string;
  [key: string]: string | undefined;
}

export interface ImportUsersResult {
  created: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
  createdUsers: User[];
}

// Types pour la prévisualisation d'import
export interface UserPreviewItem {
  lineNumber: number;
  user: ImportUserData;
  status: "valid" | "duplicate" | "error" | "warning";
  messages: string[];
  resolvedDepartment?: { id: string; name: string };
  resolvedServices?: Array<{ id: string; name: string }>;
}

export interface UsersValidationPreview {
  valid: UserPreviewItem[];
  duplicates: UserPreviewItem[];
  errors: UserPreviewItem[];
  warnings: UserPreviewItem[];
  summary: {
    total: number;
    valid: number;
    duplicates: number;
    errors: number;
    warnings: number;
  };
}

// Types pour la vérification des dépendances avant suppression
export interface UserDependency {
  type: string;
  count: number;
  description: string;
}

export interface UserDependenciesResponse {
  userId: string;
  canDelete: boolean;
  dependencies: UserDependency[];
}

// Types pour la présence
export interface UserPresenceItem {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  serviceName?: string;
  departmentName?: string;
}

export interface PresenceData {
  onSite: UserPresenceItem[];
  remote: UserPresenceItem[];
  absent: UserPresenceItem[];
  external: UserPresenceItem[];
  date: string;
  totals: {
    onSite: number;
    remote: number;
    absent: number;
    external: number;
    total: number;
  };
}
