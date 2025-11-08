// ===========================
// ENUMS
// ===========================

export enum Role {
  ADMIN = 'ADMIN',
  RESPONSABLE = 'RESPONSABLE',
  MANAGER = 'MANAGER',
  REFERENT_TECHNIQUE = 'REFERENT_TECHNIQUE',
  CONTRIBUTEUR = 'CONTRIBUTEUR',
  OBSERVATEUR = 'OBSERVATEUR',
}

export enum ProjectStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  BLOCKED = 'BLOCKED',
}

export enum Priority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum MilestoneStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DELAYED = 'DELAYED',
}

export enum RACIRole {
  RESPONSIBLE = 'RESPONSIBLE',
  ACCOUNTABLE = 'ACCOUNTABLE',
  CONSULTED = 'CONSULTED',
  INFORMED = 'INFORMED',
}

export enum ActivityType {
  DEVELOPMENT = 'DEVELOPMENT',
  MEETING = 'MEETING',
  SUPPORT = 'SUPPORT',
  TRAINING = 'TRAINING',
  OTHER = 'OTHER',
}

export enum LeaveType {
  CP = 'CP',
  RTT = 'RTT',
  SICK_LEAVE = 'SICK_LEAVE',
  UNPAID = 'UNPAID',
  OTHER = 'OTHER',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum HalfDay {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
}

export enum SkillCategory {
  TECHNICAL = 'TECHNICAL',
  METHODOLOGY = 'METHODOLOGY',
  SOFT_SKILL = 'SOFT_SKILL',
  BUSINESS = 'BUSINESS',
}

export enum SkillLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  EXPERT = 'EXPERT',
  MASTER = 'MASTER',
}

// ===========================
// USERS & AUTHENTICATION
// ===========================

export interface UserService {
  service: Service;
}

export interface User {
  id: string;
  email: string;
  login: string;
  firstName: string;
  lastName: string;
  role: Role;
  departmentId?: string;
  isActive: boolean;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  department?: Department;
  userServices?: UserService[];
}

export interface AuthResponse {
  access_token: string;
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
  role?: Role;
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

export interface Service {
  id: string;
  name: string;
  description?: string;
  departmentId: string;
  managerId?: string;
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
  createdAt: string;
  updatedAt: string;
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
  managerId: string;
  departmentId?: string;
  budget?: number;
  estimatedHours?: number;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  priority?: Priority;
  startDate?: string;
  endDate?: string;
  managerId?: string;
  departmentId?: string;
  budget?: number;
  estimatedHours?: number;
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

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  projectId: string;
  epicId?: string;
  milestoneId?: string;
  assigneeId?: string;
  estimatedHours?: number;
  progress: number;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  project?: Project;
  epic?: Epic;
  milestone?: Milestone;
  assignee?: User;
  timeEntries?: TimeEntry[];
  comments?: Comment[];
  raci?: TaskRACI[];
}

export interface TaskRACI {
  id: string;
  taskId: string;
  userId: string;
  role: RACIRole;
  createdAt: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  projectId: string;
  epicId?: string;
  milestoneId?: string;
  assigneeId?: string;
  estimatedHours?: number;
  startDate?: string;
  endDate?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  epicId?: string;
  milestoneId?: string;
  assigneeId?: string;
  estimatedHours?: number;
  progress?: number;
  startDate?: string;
  endDate?: string;
}

// ===========================
// TIME TRACKING
// ===========================

export interface TimeEntry {
  id: string;
  userId: string;
  projectId?: string;
  taskId?: string;
  date: string;
  hours: number;
  description?: string;
  activityType: ActivityType;
  createdAt: string;
  updatedAt: string;
  user?: User;
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
}

// ===========================
// HR - LEAVES
// ===========================

export interface Leave {
  id: string;
  userId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  halfDay?: HalfDay;
  days: number;
  status: LeaveStatus;
  comment?: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
}

export interface CreateLeaveDto {
  type: LeaveType;
  startDate: string;
  endDate: string;
  halfDay?: HalfDay;
  comment?: string;
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
}

// ===========================
// HR - SKILLS
// ===========================

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description?: string;
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
