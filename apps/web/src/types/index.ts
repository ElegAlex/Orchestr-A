// ===========================
// ENUMS
// ===========================

import type { RoleTemplateKey } from "rbac";

export enum ProjectStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum TaskStatus {
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  IN_REVIEW = "IN_REVIEW",
  DONE = "DONE",
  BLOCKED = "BLOCKED",
}

export enum Priority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum MilestoneStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  DELAYED = "DELAYED",
}

export enum RACIRole {
  RESPONSIBLE = "RESPONSIBLE",
  ACCOUNTABLE = "ACCOUNTABLE",
  CONSULTED = "CONSULTED",
  INFORMED = "INFORMED",
}

export enum ActivityType {
  DEVELOPMENT = "DEVELOPMENT",
  MEETING = "MEETING",
  SUPPORT = "SUPPORT",
  TRAINING = "TRAINING",
  OTHER = "OTHER",
}

export enum LeaveType {
  CP = "CP",
  RTT = "RTT",
  SICK_LEAVE = "SICK_LEAVE",
  UNPAID = "UNPAID",
  OTHER = "OTHER",
}

export enum LeaveStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLATION_REQUESTED = "CANCELLATION_REQUESTED",
}

export enum HalfDay {
  MORNING = "MORNING",
  AFTERNOON = "AFTERNOON",
}

export enum SkillCategory {
  TECHNICAL = "TECHNICAL",
  METHODOLOGY = "METHODOLOGY",
  SOFT_SKILL = "SOFT_SKILL",
  BUSINESS = "BUSINESS",
}

export enum SkillLevel {
  BEGINNER = "BEGINNER",
  INTERMEDIATE = "INTERMEDIATE",
  EXPERT = "EXPERT",
  MASTER = "MASTER",
}

export enum HolidayType {
  LEGAL = "LEGAL",
  BRIDGE = "BRIDGE",
  CLOSURE = "CLOSURE",
  CUSTOM = "CUSTOM",
}

// ===========================
// USERS & AUTHENTICATION
// ===========================

export interface UserService {
  service: Service;
}

export interface ManagedService {
  id: string;
  name: string;
}

/**
 * RBAC V0 role entity as returned by `/auth/me`.
 * Source of truth for role identification on the frontend.
 */
export interface UserRoleEntity {
  id: string;
  code: string;
  label: string;
  templateKey: RoleTemplateKey;
  isSystem: boolean;
}

export interface User {
  id: string;
  email: string;
  login: string;
  firstName: string;
  lastName: string;
  /**
   * RBAC V4 canonical role as returned by the API. `null` when the user has no
   * role assigned (edge case; seeded users always have one).
   */
  role: UserRoleEntity | null;
  roleId?: string | null;
  departmentId?: string;
  isActive: boolean;
  avatarUrl?: string | null;
  avatarPreset?: string | null;
  createdAt: string;
  updatedAt: string;
  department?: Department;
  userServices?: UserService[];
  managedServices?: ManagedService[];
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  user: User;
}

export interface LoginDto {
  login: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  login: string;
  password: string;
  firstName: string;
  lastName: string;
  departmentId?: string;
  serviceIds?: string[];
}

// ===========================
// ORGANIZATION
// ===========================

export interface Department {
  id: string;
  name: string;
  description?: string;
  managerId?: string;
  createdAt: string;
  updatedAt: string;
  manager?: User;
  services?: Service[];
  users?: User[];
}

// Version simplifiée pour les inclusions dans User
export interface DepartmentBasic {
  id: string;
  name: string;
  managerId?: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  departmentId: string;
  managerId?: string;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
  manager?: User;
  department?: Department;
  users?: User[];
  members?: User[];
}

export interface CreateDepartmentDto {
  name: string;
  description?: string;
  managerId?: string;
}

export interface CreateServiceDto {
  name: string;
  description?: string;
  departmentId: string;
  managerId?: string;
  color?: string;
}

// ===========================
// PROJECTS
// ===========================

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: Priority;
  startDate?: string;
  endDate?: string;
  budgetHours?: number;
  progress?: number;
  icon?: string | null;
  hiddenStatuses?: TaskStatus[];
  visibleStatuses?: string[];
  createdAt: string;
  updatedAt: string;
  createdById?: string;
  managerId?: string | null;
  sponsorId?: string | null;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    login: string;
  } | null;
  manager?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  sponsor?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  members?: ProjectMember[];
  epics?: Epic[];
  milestones?: Milestone[];
  tasks?: Task[];
  documents?: Document[];
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  allocation?: number;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  user?: User;
}

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  progress: number;
  totalHours: number;
  loggedHours: number;
  thirdPartyLoggedHours: number;
  remainingHours: number;
  membersCount: number;
  epicsCount: number;
  milestonesCount: number;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  status?: ProjectStatus;
  priority?: Priority;
  startDate: string;
  endDate: string;
  budgetHours?: number;
  icon?: string | null;
  managerId?: string;
  sponsorId?: string | null;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  icon?: string | null;
  status?: ProjectStatus;
  priority?: Priority;
  startDate?: string;
  endDate?: string;
  managerId?: string | null;
  sponsorId?: string | null;
  departmentId?: string;
  budget?: number;
  estimatedHours?: number;
  budgetHours?: number;
  hiddenStatuses?: TaskStatus[];
  visibleStatuses?: string[];
}

export interface AddMemberDto {
  userId: string;
  role: string;
  allocation?: number;
  startDate?: string;
  endDate?: string;
}

// ===========================
// EPICS & MILESTONES
// ===========================

export interface Epic {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  progress: number;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  tasks?: Task[];
}

export interface Milestone {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  dueDate: string;
  status: MilestoneStatus;
  createdAt: string;
  updatedAt: string;
  tasks?: Task[];
}

// ===========================
// TASKS
// ===========================

export interface TaskDependency {
  id?: string;
  dependsOnTaskId: string;
  dependsOnTask?: {
    id: string;
    title: string;
    status: TaskStatus;
    endDate?: string;
  };
}

export interface TaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  createdAt: string;
  user?: User;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  projectId?: string | null; // Nullable pour les tâches orphelines
  epicId?: string;
  milestoneId?: string;
  assigneeId?: string; // Assigné principal (rétrocompatibilité)
  estimatedHours?: number;
  progress: number;
  startDate?: string;
  endDate?: string;
  startTime?: string; // Horaire de début optionnel (format HH:MM)
  endTime?: string; // Horaire de fin optionnel (format HH:MM)
  createdAt: string;
  updatedAt: string;
  project?: Project | null;
  epic?: Epic;
  milestone?: Milestone;
  assignee?: User; // Assigné principal
  assignees?: TaskAssignee[]; // Assignés multiples
  isExternalIntervention?: boolean;
  timeEntries?: TimeEntry[];
  comments?: Comment[];
  raci?: TaskRACI[];
  subtasks?: Subtask[];
  dependencies?: TaskDependency[];
  thirdPartyAssignees?: TaskThirdPartyAssignee[];
}

export interface TaskRACI {
  id: string;
  taskId: string;
  userId: string;
  role: RACIRole;
  createdAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  position: number;
  taskId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  projectId?: string | null; // Optionnel pour les tâches orphelines
  epicId?: string;
  milestoneId?: string;
  assigneeId?: string; // Assigné principal (rétrocompatibilité)
  assigneeIds?: string[]; // Assignés multiples
  serviceIds?: string[]; // Services à inviter (résolution en membres)
  estimatedHours?: number;
  startDate?: string;
  endDate?: string;
  startTime?: string; // Horaire de début optionnel (format HH:MM)
  endTime?: string; // Horaire de fin optionnel (format HH:MM)
  isExternalIntervention?: boolean; // Intervention extérieure
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  epicId?: string;
  milestoneId?: string;
  assigneeId?: string; // Assigné principal (rétrocompatibilité)
  assigneeIds?: string[]; // Assignés multiples
  serviceIds?: string[]; // Services à inviter (résolution en membres)
  estimatedHours?: number;
  progress?: number;
  startDate?: string;
  endDate?: string;
  startTime?: string; // Horaire de début optionnel (format HH:MM)
  endTime?: string; // Horaire de fin optionnel (format HH:MM)
  isExternalIntervention?: boolean; // Intervention extérieure
}

// ===========================
// TIME TRACKING
// ===========================

export interface TimeEntry {
  id: string;
  userId?: string | null;
  thirdPartyId?: string | null;
  declaredById: string;
  projectId?: string;
  taskId?: string;
  date: string;
  hours: number;
  description?: string;
  activityType: ActivityType;
  createdAt: string;
  updatedAt: string;
  user?: User | null;
  thirdParty?: ThirdParty | null;
  declaredBy?: User;
  project?: Project;
  task?: Task;
}

export interface CreateTimeEntryDto {
  projectId?: string;
  taskId?: string;
  date: string;
  hours: number;
  description?: string;
  activityType: ActivityType;
  /**
   * Optional — declares time on behalf of a third party instead of the current user.
   * Requires `time_tracking:declare_for_third_party` permission.
   */
  thirdPartyId?: string;
}

// ===========================
// THIRD PARTIES
// ===========================

export enum ThirdPartyType {
  EXTERNAL_PROVIDER = "EXTERNAL_PROVIDER",
  INTERNAL_NON_USER = "INTERNAL_NON_USER",
  LEGAL_ENTITY = "LEGAL_ENTITY",
}

export interface ThirdParty {
  id: string;
  type: ThirdPartyType;
  organizationName: string;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  _count?: {
    taskAssignments: number;
    projectMemberships: number;
    timeEntries: number;
  };
}

export interface CreateThirdPartyDto {
  type: ThirdPartyType;
  organizationName: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactEmail?: string;
  notes?: string;
}

export interface UpdateThirdPartyDto extends Partial<CreateThirdPartyDto> {
  isActive?: boolean;
}

export interface QueryThirdPartyDto {
  type?: ThirdPartyType;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ThirdPartyDeletionImpact {
  timeEntriesCount: number;
  taskAssignmentsCount: number;
  projectMembershipsCount: number;
}

export interface TaskThirdPartyAssignee {
  id: string;
  taskId: string;
  thirdPartyId: string;
  assignedById: string;
  createdAt: string;
  thirdParty?: ThirdParty;
}

export interface ProjectThirdPartyMember {
  id: string;
  projectId: string;
  thirdPartyId: string;
  allocation?: number | null;
  assignedById: string;
  createdAt: string;
  thirdParty?: ThirdParty;
}

// ===========================
// HR - LEAVES
// ===========================

export interface LeaveTypeConfig {
  id: string;
  code: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  isPaid: boolean;
  requiresApproval: boolean;
  maxDaysPerYear?: number | null;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Leave {
  id: string;
  userId: string;
  leaveTypeId?: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  halfDay?: HalfDay;
  days: number;
  status: LeaveStatus;
  comment?: string;

  // Champs de validation
  validatorId?: string;
  validatedById?: string;
  validatedAt?: string;
  validationComment?: string;

  createdAt: string;
  updatedAt: string;

  // Relations
  user?: User;
  leaveType?: LeaveTypeConfig;
  validator?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  validatedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
}

export interface CreateLeaveDto {
  leaveTypeId: string;
  type?: LeaveType; // Déprécié, utiliser leaveTypeId
  startDate: string;
  endDate: string;
  halfDay?: HalfDay;
  reason?: string;
}

// ===========================
// HR - TELEWORK
// ===========================

export interface TeleworkSchedule {
  id: string;
  userId: string;
  date: string;
  isTelework: boolean;
  isException: boolean;
  createdAt: string;
  user?: User;
}

export interface CreateTeleworkDto {
  date: string;
  isTelework: boolean;
  isException?: boolean;
  userId?: string;
}

export interface TeleworkRecurringRule {
  id: string;
  userId: string;
  dayOfWeek: number; // 0=Monday ... 6=Sunday
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, "id" | "firstName" | "lastName" | "email" | "role">;
  createdBy?: Pick<User, "id" | "firstName" | "lastName">;
}

export interface CreateRecurringRuleDto {
  userId?: string;
  dayOfWeek: number;
  startDate: string;
  endDate?: string;
  isActive?: boolean;
}

export interface UpdateRecurringRuleDto {
  dayOfWeek?: number;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

export interface GenerateSchedulesDto {
  startDate: string;
  endDate: string;
}

// ===========================
// HR - SKILLS
// ===========================

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description?: string;
  requiredCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserSkill {
  userId: string;
  skillId: string;
  level: SkillLevel;
  validatedBy?: string;
  createdAt: string;
  updatedAt: string;
  skill?: Skill;
}

// ===========================
// DOCUMENTS
// ===========================

export interface Document {
  id: string;
  name: string;
  description?: string;
  url: string;
  mimeType: string;
  size: number;
  projectId: string;
  uploadedBy: string;
  createdAt: string;
}

// ===========================
// COMMENTS
// ===========================

export interface Comment {
  id: string;
  content: string;
  taskId: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  author?: User;
}

export interface CreateCommentDto {
  content: string;
  taskId: string;
}

// ===========================
// API RESPONSES
// ===========================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  error?: string;
  statusCode: number;
}

// ===========================
// HOLIDAYS (JOURS FERIES)
// ===========================

export interface Holiday {
  id: string;
  date: string;
  name: string;
  type: HolidayType;
  isWorkDay: boolean;
  description?: string;
  recurring: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateHolidayDto {
  date: string;
  name: string;
  type?: HolidayType;
  isWorkDay?: boolean;
  description?: string;
  recurring?: boolean;
}

export interface UpdateHolidayDto {
  date?: string;
  name?: string;
  type?: HolidayType;
  isWorkDay?: boolean;
  description?: string;
  recurring?: boolean;
}

export interface ImportFrenchHolidaysResult {
  created: number;
  skipped: number;
}

export const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  [HolidayType.LEGAL]: "Ferie legal",
  [HolidayType.BRIDGE]: "Pont",
  [HolidayType.CLOSURE]: "Fermeture exceptionnelle",
  [HolidayType.CUSTOM]: "Personnalise",
};

export const HOLIDAY_TYPE_COLORS: Record<HolidayType, string> = {
  [HolidayType.LEGAL]: "bg-red-100 text-red-800",
  [HolidayType.BRIDGE]: "bg-orange-100 text-orange-800",
  [HolidayType.CLOSURE]: "bg-purple-100 text-purple-800",
  [HolidayType.CUSTOM]: "bg-gray-100 text-gray-800",
};

// ===========================
// SCHOOL VACATIONS (VACANCES SCOLAIRES)
// ===========================

export enum SchoolVacationZone {
  A = "A",
  B = "B",
  C = "C",
}

export enum SchoolVacationSource {
  IMPORT = "IMPORT",
  MANUAL = "MANUAL",
}

export interface SchoolVacation {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  zone: SchoolVacationZone;
  year: number;
  source: SchoolVacationSource;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateSchoolVacationDto {
  name: string;
  startDate: string;
  endDate: string;
  zone?: SchoolVacationZone;
  year: number;
  source?: SchoolVacationSource;
}

export interface UpdateSchoolVacationDto {
  name?: string;
  startDate?: string;
  endDate?: string;
  zone?: SchoolVacationZone;
  year?: number;
}

export interface ImportSchoolVacationResult {
  created: number;
  skipped: number;
}

export const SCHOOL_VACATION_ZONE_LABELS: Record<SchoolVacationZone, string> = {
  [SchoolVacationZone.A]: "Zone A",
  [SchoolVacationZone.B]: "Zone B",
  [SchoolVacationZone.C]: "Zone C",
};

export const SCHOOL_VACATION_SOURCE_LABELS: Record<SchoolVacationSource, string> = {
  [SchoolVacationSource.IMPORT]: "Import",
  [SchoolVacationSource.MANUAL]: "Manuel",
};

export const SCHOOL_VACATION_SOURCE_COLORS: Record<SchoolVacationSource, string> = {
  [SchoolVacationSource.IMPORT]: "bg-blue-100 text-blue-800",
  [SchoolVacationSource.MANUAL]: "bg-gray-100 text-gray-800",
};

// ===========================
// RBAC - ROLE MANAGEMENT
// ===========================

export interface Permission {
  id: string;
  code: string;
  module: string;
  action: string;
  name?: string;
  resource?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleConfig {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermission {
  id: string;
  roleId: string;
  permissionId: string;
  createdAt: string;
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
  permissionIds?: string[];
}

export interface CreatePermissionDto {
  name: string;
  action: string;
  resource: string;
  description?: string;
}
