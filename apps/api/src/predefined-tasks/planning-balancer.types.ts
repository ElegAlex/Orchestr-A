/**
 * planning-balancer.types.ts
 *
 * Types d'entrée/sortie de PlanningBalancerService (cf. ADR-03).
 * Pure, aucune dépendance Prisma ou NestJS.
 */

export type BalancerPeriod = 'MORNING' | 'AFTERNOON' | 'FULL_DAY';

export interface BalancerOccurrence {
  taskId: string;
  weight: number; // 1..5
  date: Date;
  period: BalancerPeriod;
}

export interface BalancerAgent {
  userId: string;
  skills?: string[];
}

export interface BalancerAbsence {
  startDate: Date;
  endDate: Date;
}

export interface BalancerTelework {
  date: Date;
}

export interface BalancerInput {
  occurrences: BalancerOccurrence[];
  agents: BalancerAgent[];
  /** Indexé par userId */
  absences: Map<string, BalancerAbsence[]>;
  /** Indexé par userId */
  telework?: Map<string, BalancerTelework[]>;
  /** Indexé par taskId, true par défaut */
  taskTeleworkAllowed?: Map<string, boolean>;
  /** Indexé par taskId, optionnel */
  taskRequiredSkills?: Map<string, string[]>;
}

export interface BalancerProposedAssignment {
  taskId: string;
  userId: string;
  date: Date;
  period: BalancerPeriod;
  weight: number;
}

export type BalancerUnassignedReason =
  | 'NO_ELIGIBLE_AGENT'
  | 'ABSENCE_CONFLICT'
  | 'TELEWORK_CONFLICT'
  | 'SKILL_CONFLICT';

export interface BalancerUnassigned {
  taskId: string;
  date: Date;
  period: BalancerPeriod;
  reason: BalancerUnassignedReason;
}

export interface BalancerOutput {
  proposedAssignments: BalancerProposedAssignment[];
  workloadByAgent: Array<{ userId: string; weightedLoad: number }>;
  /** 1 - σ/µ clamped [0..1], 1 = équilibre parfait */
  equityRatio: number;
  unassignedOccurrences: BalancerUnassigned[];
}
