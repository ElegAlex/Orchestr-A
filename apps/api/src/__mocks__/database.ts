// Mock du module database pour les tests

// Mock PrismaClient class
export class PrismaClient {
  async $connect() {}
  async $disconnect() {}
}

export const Role = {
  ADMIN: 'ADMIN',
  RESPONSABLE: 'RESPONSABLE',
  MANAGER: 'MANAGER',
  REFERENT_TECHNIQUE: 'REFERENT_TECHNIQUE',
  CONTRIBUTEUR: 'CONTRIBUTEUR',
  OBSERVATEUR: 'OBSERVATEUR',
} as const;

export const LeaveStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const LeaveType = {
  CP: 'CP',
  RTT: 'RTT',
  SICK_LEAVE: 'SICK_LEAVE',
  UNPAID: 'UNPAID',
  OTHER: 'OTHER',
} as const;

export const TaskStatus = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  DONE: 'DONE',
  BLOCKED: 'BLOCKED',
} as const;

export const Priority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export const ProjectStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const SkillCategory = {
  TECHNICAL: 'TECHNICAL',
  METHODOLOGY: 'METHODOLOGY',
  SOFT_SKILL: 'SOFT_SKILL',
  BUSINESS: 'BUSINESS',
} as const;

export const SkillLevel = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  EXPERT: 'EXPERT',
  MASTER: 'MASTER',
} as const;

export const MilestoneStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  DELAYED: 'DELAYED',
} as const;

export const ActivityType = {
  DEVELOPMENT: 'DEVELOPMENT',
  MEETING: 'MEETING',
  SUPPORT: 'SUPPORT',
  TRAINING: 'TRAINING',
  OTHER: 'OTHER',
} as const;

export const RACIRole = {
  RESPONSIBLE: 'RESPONSIBLE',
  ACCOUNTABLE: 'ACCOUNTABLE',
  CONSULTED: 'CONSULTED',
  INFORMED: 'INFORMED',
} as const;

export const HalfDay = {
  MORNING: 'MORNING',
  AFTERNOON: 'AFTERNOON',
} as const;
