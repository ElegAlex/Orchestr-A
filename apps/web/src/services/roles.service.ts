/**
 * roles.service.ts — Service client de la galerie admin Spec 3 V1D.
 *
 * Consomme les endpoints `/api/roles/*` (nouveau controller RBAC, cf.
 * `apps/api/src/rbac/roles.controller.ts`). Coexiste avec l'ancien
 * `role-management.service.ts` jusqu'à V2 (où il sera consolidé).
 */

import { api } from "@/lib/api";
import type { PermissionCode, RoleTemplateKey, RoleCategoryKey } from "rbac";

/**
 * Vue d'un template telle que renvoyée par `GET /api/roles/templates`.
 * Correspond au `TemplateView` du `RolesService` backend.
 */
export interface RoleTemplateView {
  key: RoleTemplateKey;
  defaultLabel: string;
  category: RoleCategoryKey;
  description: string;
  permissions: readonly PermissionCode[];
}

/**
 * Rôle DB enrichi tel que renvoyé par `GET /api/roles`.
 * Correspond au `RoleWithStats` du `RolesService` backend.
 */
export interface RoleWithStats {
  id: string;
  code: string;
  label: string;
  templateKey: RoleTemplateKey;
  description: string | null;
  isSystem: boolean;
  isDefault: boolean;
  userCount: number;
  permissionsCount: number;
  category: RoleCategoryKey;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleV2Dto {
  code: string;
  label: string;
  templateKey: RoleTemplateKey;
  description?: string;
  isDefault?: boolean;
}

/**
 * Payload d'édition d'un rôle. `templateKey` n'y figure pas : un rôle créé
 * sur un template y reste à vie (ValidationPipe back rejette 400 si passé).
 * Pour changer le template d'un rôle : supprimer + recréer.
 */
export interface UpdateRoleV2Dto {
  label?: string;
  description?: string;
  isDefault?: boolean;
}

export const rolesService = {
  async getTemplates(): Promise<RoleTemplateView[]> {
    const response = await api.get<RoleTemplateView[]>("/roles/templates");
    return response.data;
  },

  async listRoles(): Promise<RoleWithStats[]> {
    const response = await api.get<RoleWithStats[]>("/roles");
    return response.data;
  },

  async createRole(dto: CreateRoleV2Dto): Promise<RoleWithStats> {
    const response = await api.post<RoleWithStats>("/roles", dto);
    return response.data;
  },

  async updateRole(id: string, dto: UpdateRoleV2Dto): Promise<RoleWithStats> {
    const response = await api.patch<RoleWithStats>(`/roles/${id}`, dto);
    return response.data;
  },

  async deleteRole(id: string): Promise<void> {
    await api.delete(`/roles/${id}`);
  },
};
