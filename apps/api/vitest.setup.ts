import 'reflect-metadata';
import { vi } from 'vitest';

// Force Europe/Paris timezone for every test run.
// Year-window math (cf. uniform leave balance) is anchored on Paris time;
// CI runners default to UTC, which would silently flip edge-day leaves
// across calendar years. Setting this here before any Date instantiation
// in test modules keeps results deterministic locally and in GitHub Actions.
//
// Opt-out: set `LEAVE_TZ_OVERRIDE_OFF=1` in the shell. Used by the
// `test:tz-utc` script to prove the leave-year-window helper is
// host-TZ-independent by construction (date-fns-tz with explicit zone),
// not just because we forced Paris everywhere.
if (process.env.LEAVE_TZ_OVERRIDE_OFF !== '1') {
  process.env.TZ = 'Europe/Paris';
}

// OBS-028 — AuditService HMACs the attempted-login identifier (LOGIN_FAILURE /
// ACCOUNT_LOCKED entityId) with AUDIT_HASH_KEY. Provide a fixed, ≥32-char test key
// so audit specs compute deterministic hashes (the real key is env-provisioned and
// asserted at boot, never falling back to storing the raw identifier).
process.env.AUDIT_HASH_KEY ??=
  'test-audit-hash-key-deterministic-0123456789abcdef';

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
  CANCELLATION_REQUESTED = 'CANCELLATION_REQUESTED',
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

export enum SchoolVacationZone {
  A = 'A',
  B = 'B',
  C = 'C',
}

export enum SchoolVacationSource {
  IMPORT = 'IMPORT',
  MANUAL = 'MANUAL',
}

export enum ThirdPartyType {
  EXTERNAL_PROVIDER = 'EXTERNAL_PROVIDER',
  INTERNAL_NON_USER = 'INTERNAL_NON_USER',
  LEGAL_ENTITY = 'LEGAL_ENTITY',
}

// DAT-012 — string→enum promotions.
export enum PredefinedTaskDuration {
  HALF_DAY = 'HALF_DAY',
  FULL_DAY = 'FULL_DAY',
  TIME_SLOT = 'TIME_SLOT',
}

export enum DayPeriod {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  FULL_DAY = 'FULL_DAY',
}

export enum AssignmentCompletionStatus {
  NOT_DONE = 'NOT_DONE',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export enum RecurrenceType {
  WEEKLY = 'WEEKLY',
  MONTHLY_ORDINAL = 'MONTHLY_ORDINAL',
  MONTHLY_DAY = 'MONTHLY_DAY',
}

export enum AppSettingsCategory {
  display = 'display',
  general = 'general',
  planning = 'planning',
}

// Mock PrismaClient for tests
class MockPrismaClient {
  $connect = vi.fn();
  $disconnect = vi.fn();
  $on = vi.fn();
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
    SchoolVacationZone,
    SchoolVacationSource,
    ThirdPartyType,
    PredefinedTaskDuration,
    DayPeriod,
    AssignmentCompletionStatus,
    RecurrenceType,
    AppSettingsCategory,
  };
});
