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
  TECHNICIEN_SUPPORT = "TECHNICIEN_SUPPORT",
  GESTIONNAIRE_PARC = "GESTIONNAIRE_PARC",
  ADMINISTRATEUR_IML = "ADMINISTRATEUR_IML",
  DEVELOPPEUR_CONCEPTEUR = "DEVELOPPEUR_CONCEPTEUR",
  CORRESPONDANT_FONCTIONNEL_APPLICATION = "CORRESPONDANT_FONCTIONNEL_APPLICATION",
  CHARGE_DE_MISSION = "CHARGE_DE_MISSION",
  GESTIONNAIRE_IML = "GESTIONNAIRE_IML",
  CONSULTANT_TECHNOLOGIE_SI = "CONSULTANT_TECHNOLOGIE_SI",
}

export enum TaskStatus {
  TODO = "TODO",
  STARTED = "STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  IN_REVIEW = "IN_REVIEW",
  DONE = "DONE",
  BLOCKED = "BLOCKED",
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
  isRecurring?: boolean;
  recurrenceWeekInterval?: number | null;
  recurrenceDay?: number | null;
  recurrenceEndDate?: Date | string | null;
  parentEventId?: string | null;
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
  serviceIds?: string[];
  isRecurring?: boolean;
  recurrenceWeekInterval?: number;
  recurrenceDay?: number;
  recurrenceEndDate?: Date | string;
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
  serviceIds?: string[];
  isRecurring?: boolean;
  recurrenceWeekInterval?: number;
  recurrenceDay?: number;
  recurrenceEndDate?: Date | string;
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
