import { api } from "@/lib/api";
import {
  RoleConfigWithPermissions,
  Permission,
  CreateRoleConfigDto,
  UpdateRoleConfigDto,
} from "@/types";

export interface PermissionsGroupedByModule {
  [module: string]: Permission[];
}

export const roleManagementService = {
  /**
   * Liste tous les rôles avec leurs permissions
   */
  async getAllRoles(): Promise<RoleConfigWithPermissions[]> {
    const response = await api.get<RoleConfigWithPermissions[]>(
      "/role-management/roles",
    );
    return response.data;
  },

  /**
   * Créer un rôle custom
   */
  async createRole(data: CreateRoleConfigDto): Promise<RoleConfigWithPermissions> {
    const response = await api.post<RoleConfigWithPermissions>(
      "/role-management/roles",
      data,
    );
    return response.data;
  },

  /**
   * Détail d'un rôle avec ses permissions
   */
  async getRole(id: string): Promise<RoleConfigWithPermissions> {
    const response = await api.get<RoleConfigWithPermissions>(
      `/role-management/roles/${id}`,
    );
    return response.data;
  },

  /**
   * Modifier nom/description d'un rôle
   */
  async updateRole(
    id: string,
    data: UpdateRoleConfigDto,
  ): Promise<RoleConfigWithPermissions> {
    const response = await api.patch<RoleConfigWithPermissions>(
      `/role-management/roles/${id}`,
      data,
    );
    return response.data;
  },

  /**
   * Supprimer un rôle (interdit si isSystem: true)
   */
  async deleteRole(id: string): Promise<void> {
    await api.delete(`/role-management/roles/${id}`);
  },

  /**
   * Liste toutes les permissions (groupées par module)
   */
  async getAllPermissions(): Promise<PermissionsGroupedByModule> {
    const response = await api.get<PermissionsGroupedByModule>(
      "/role-management/permissions",
    );
    return response.data;
  },

  /**
   * Remplacer les permissions d'un rôle
   */
  async replaceRolePermissions(
    id: string,
    permissionIds: string[],
  ): Promise<RoleConfigWithPermissions> {
    const response = await api.put<RoleConfigWithPermissions>(
      `/role-management/roles/${id}/permissions`,
      { permissionIds },
    );
    return response.data;
  },

  /**
   * Seeder les permissions et rôles initiaux
   */
  async seedPermissionsAndRoles(): Promise<{
    message: string;
    permissionsCreated: number;
    rolesCreated: number;
  }> {
    const response = await api.post<{
      message: string;
      permissionsCreated: number;
      rolesCreated: number;
    }>("/role-management/seed");
    return response.data;
  },
};
