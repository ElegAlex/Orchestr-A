// ===========================
// ENUMS
// ===========================

export enum Role {
  ADMIN = "ADMIN",
  RESPONSABLE = "RESPONSABLE",
  MANAGER = "MANAGER",
  CHEF_DE_PROJET = "CHEF_DE_PROJET",
  REFERENT_TECHNIQUE = "REFERENT_TECHNIQUE",
  CONTRIBUTEUR = "CONTRIBUTEUR",
  OBSERVATEUR = "OBSERVATEUR",
}

// ===========================
// EVENTS
// ===========================

export interface Event {
  id: string;
  title: string;
  description?: string | null;
  date: Date | string;
  startTime?: string | null;
  endTime?: string | null;
  isAllDay: boolean;
  projectId?: string | null;
  createdById: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface EventParticipant {
  eventId: string;
  userId: string;
}

export interface EventWithParticipants extends Event {
  participants: EventParticipant[];
}

export interface CreateEventDto {
  title: string;
  description?: string;
  date: Date | string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  projectId?: string;
  participantIds?: string[];
}

export interface UpdateEventDto {
  title?: string;
  description?: string;
  date?: Date | string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  projectId?: string;
  participantIds?: string[];
}

// ===========================
// RBAC - DYNAMIC PERMISSIONS
// ===========================

export interface Permission {
  id: string;
  code: string;
  module: string;
  action: string;
  description?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RoleConfig {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  isDefault: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RolePermission {
  roleConfigId: string;
  permissionId: string;
}

export interface RoleConfigWithPermissions extends RoleConfig {
  permissions: Array<{
    permission: Permission;
  }>;
}

export interface CreateRoleConfigDto {
  code: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  permissionIds?: string[];
}

export interface UpdateRoleConfigDto {
  code?: string;
  name?: string;
  description?: string;
  isDefault?: boolean;
  permissionIds?: string[];
}

export interface CreatePermissionDto {
  code: string;
  module: string;
  action: string;
  description?: string;
}
