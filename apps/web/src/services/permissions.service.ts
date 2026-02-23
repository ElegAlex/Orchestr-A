import { api } from "@/lib/api";

export const permissionsService = {
  async getMyPermissions(): Promise<string[]> {
    const response = await api.get<{ permissions: string[] }>(
      "/auth/me/permissions",
    );
    return response.data.permissions;
  },
};
