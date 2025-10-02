import { Timestamp } from 'firebase/firestore';

// =====================================
// TYPES CORE
// =====================================

export type TeleworkMode = 'office' | 'remote';
export type WeekdayPattern = 'office' | 'remote' | 'default';
export type OverrideSource = 'user_request' | 'admin_imposed' | 'team_requirement';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type RecurrenceType = 'weekly' | 'monthly' | 'specific_dates';

// =====================================
// PROFIL UTILISATEUR TÉLÉTRAVAIL
// =====================================

export interface UserTeleworkProfile {
  id: string;                          // userId
  userId: string;
  displayName: string;
  defaultMode: TeleworkMode;           // Mode par défaut de l'employé
  weeklyPattern: {
    monday: WeekdayPattern;
    tuesday: WeekdayPattern;
    wednesday: WeekdayPattern;
    thursday: WeekdayPattern;
    friday: WeekdayPattern;
    saturday: WeekdayPattern;
    sunday: WeekdayPattern;
  };
  constraints: {
    maxRemoteDaysPerWeek: number;      // Limite contractuelle
    maxConsecutiveRemoteDays: number;   // Max jours télétravail consécutifs
    requiresApproval: boolean;         // Nécessite approbation manager
  };
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

// =====================================
// EXCEPTIONS PONCTUELLES
// =====================================

export interface TeleworkOverride {
  id: string;                          // userId_YYYY-MM-DD
  userId: string;
  date: Timestamp;
  mode: TeleworkMode;
  reason?: string;                     // "Réunion importante", "RDV médical"
  source: OverrideSource;
  priority: number;                    // 1=basse, 5=critique
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectedBy?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
  expiresAt?: Timestamp;               // Auto-suppression
  createdBy: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

// =====================================
// RÈGLES ÉQUIPE
// =====================================

export interface TeamTeleworkRule {
  id: string;
  teamId: string;
  departmentId?: string;
  name: string;                        // "Réunion équipe", "Sprint Planning"
  description: string;
  recurrence: {
    type: RecurrenceType;
    weeklyPattern?: {
      dayOfWeek: number;               // 0=dimanche, 1=lundi, ..., 6=samedi
      weekFrequency: number;           // 1=chaque semaine, 2=toutes les 2 semaines
      startTime?: string;              // "09:00"
      endTime?: string;                // "17:00"
    };
    monthlyPattern?: {
      dayOfMonth: number;              // 1-31
      monthFrequency: number;          // 1=chaque mois
    };
    specificDates?: Date[];
  };
  requiredMode: TeleworkMode;
  affectedUserIds: string[];           // Utilisateurs concernés
  priority: number;                    // Plus haut = prioritaire
  isActive: boolean;
  exemptions: string[];                // UserIds exemptés
  createdBy: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

// =====================================
// RÉSOLUTION ET VALIDATION
// =====================================

export interface TeleworkDayResolution {
  date: Date;
  userId: string;
  resolvedMode: TeleworkMode;
  source: 'default' | 'pattern' | 'override' | 'team_rule' | 'admin_imposed';
  confidence: number;                  // 0-100, certitude de la résolution
  appliedRules: {
    profile?: UserTeleworkProfile;
    override?: TeleworkOverride;
    teamRules?: TeamTeleworkRule[];
  };
  conflicts: TeleworkConflict[];
  warnings: string[];
}

export interface TeleworkConflict {
  type: 'constraint_violation' | 'team_rule_conflict' | 'approval_required';
  severity: 'info' | 'warning' | 'error';
  message: string;
  source: string;
  resolutionSuggestions: string[];
}

export interface ValidationResult {
  isValid: boolean;
  canProceed: boolean;
  reason?: string;
  conflicts: TeleworkConflict[];
  requiresApproval: boolean;
  approverId?: string;
  estimatedProcessingTime?: string;
}

// =====================================
// STATISTIQUES ET ANALYTICS
// =====================================

export interface TeleworkStats {
  userId: string;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalWorkDays: number;
    remoteDays: number;
    officeDays: number;
    remotePercentage: number;
    averageRemoteDaysPerWeek: number;
  };
  breakdown: {
    bySource: Record<string, number>;
    byWeekday: Record<string, { remote: number; office: number }>;
    trends: {
      lastMonth: number;
      currentMonth: number;
      change: number;
    };
  };
  compliance: {
    withinLimits: boolean;
    exceedDays: number;
    violations: TeleworkConflict[];
  };
}

// =====================================
// CONFIGURATIONS ET PRÉFÉRENCES
// =====================================

export interface TeleworkSystemConfig {
  id: string;
  organizationId: string;
  globalSettings: {
    defaultMode: TeleworkMode;
    maxRemoteDaysPerWeek: number;
    requireManagerApproval: boolean;
    allowWeekendWork: boolean;
    autoApprovalRules: {
      enabled: boolean;
      maxDaysWithoutApproval: number;
      trustedUsers: string[];
    };
  };
  workingDays: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  holidayCalendarId?: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// =====================================
// TYPES D'INTERFACE UTILISATEUR
// =====================================

export interface TeleworkDayDisplayProps {
  date: Date;
  userId: string;
  resolution: TeleworkDayResolution;
  isEditable: boolean;
  showDetails: boolean;
  onModeChange: (mode: TeleworkMode) => void;
  onRequestOverride: (mode: TeleworkMode, reason?: string) => void;
  onViewDetails: () => void;
}

export interface TeleworkWeekViewData {
  weekStart: Date;
  weekEnd: Date;
  days: TeleworkDayResolution[];
  weeklyStats: {
    remoteDays: number;
    officeDays: number;
    conflicts: number;
    pendingApprovals: number;
  };
}

export interface TeleworkModalState {
  isOpen: boolean;
  mode: 'profile' | 'override' | 'approval' | 'stats';
  data?: any;
  selectedDate?: Date;
  targetUserId?: string;
}

// =====================================
// ACTIONS ET CALLBACKS
// =====================================

export interface TeleworkActions {
  updateProfile: (profile: Partial<UserTeleworkProfile>) => Promise<void>;
  requestOverride: (override: Omit<TeleworkOverride, 'id' | 'createdAt' | 'approvalStatus'>) => Promise<string>;
  approveOverride: (overrideId: string, reason?: string) => Promise<void>;
  rejectOverride: (overrideId: string, reason: string) => Promise<void>;
  deleteOverride: (overrideId: string) => Promise<void>;
  bulkUpdateWeek: (userId: string, weekStart: Date, pattern: Record<string, TeleworkMode>) => Promise<void>;
  exportSchedule: (userId: string, startDate: Date, endDate: Date) => Promise<Blob>;
}

// =====================================
// UTILITAIRES
// =====================================

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
export type WeekdayKey = typeof WEEKDAYS[number];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche'
};

export const MODE_LABELS: Record<TeleworkMode, string> = {
  office: 'Bureau',
  remote: 'Télétravail'
};

export const MODE_ICONS: Record<TeleworkMode, string> = {
  office: '🏢',
  remote: '🏠'
};

export const SOURCE_LABELS: Record<string, string> = {
  default: 'Par défaut',
  pattern: 'Planning type',
  override: 'Exception',
  team_rule: 'Règle équipe',
  admin_imposed: 'Imposé admin'
};