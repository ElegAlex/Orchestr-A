import 'reflect-metadata';
import { vi } from 'vitest';

// Mock Prisma enums for tests
// These enums are exported from @prisma/client and need to be available in tests

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

export enum MilestoneStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DELAYED = 'DELAYED',
  CANCELLED = 'CANCELLED',
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE',
  BLOCKED = 'BLOCKED',
  CANCELLED = 'CANCELLED',
}

export enum Priority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum RACIRole {
  RESPONSIBLE = 'RESPONSIBLE',
  ACCOUNTABLE = 'ACCOUNTABLE',
  CONSULTED = 'CONSULTED',
  INFORMED = 'INFORMED',
}

export enum ActivityType {
  DEVELOPMENT = 'DEVELOPMENT',
  CODE_REVIEW = 'CODE_REVIEW',
  TESTING = 'TESTING',
  DOCUMENTATION = 'DOCUMENTATION',
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
  CANCELLED = 'CANCELLED',
}

export enum HalfDay {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
}

export enum SkillCategory {
  TECHNICAL = 'TECHNICAL',
  MANAGEMENT = 'MANAGEMENT',
  COMMUNICATION = 'COMMUNICATION',
  OTHER = 'OTHER',
}

export enum SkillLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT',
}

export enum HolidayType {
  NATIONAL = 'NATIONAL',
  REGIONAL = 'REGIONAL',
  COMPANY = 'COMPANY',
}

// Mock PrismaClient for tests
class MockPrismaClient {
  $connect = vi.fn();
  $disconnect = vi.fn();
  $transaction = vi.fn((callback: (tx: MockPrismaClient) => Promise<unknown>) =>
    callback(this),
  );
}

// Mock the database module with enums and PrismaClient
vi.mock('database', () => {
  return {
    PrismaClient: MockPrismaClient,
    Prisma: {
      PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
        code: string;
        constructor(message: string, { code }: { code: string }) {
          super(message);
          this.code = code;
        }
      },
    },
    Role,
    ProjectStatus,
    MilestoneStatus,
    TaskStatus,
    Priority,
    RACIRole,
    ActivityType,
    LeaveType,
    LeaveStatus,
    HalfDay,
    SkillCategory,
    SkillLevel,
    HolidayType,
  };
});
