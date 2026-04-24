import { Injectable } from '@nestjs/common';
import {
  BalancerInput,
  BalancerOutput,
  BalancerAbsence,
  BalancerAgent,
  BalancerProposedAssignment,
  BalancerUnassigned,
} from './planning-balancer.types';

/**
 * Heuristique gloutonne d'équilibrage de charge (cf. ADR-03).
 *
 * - Tri des occurrences par (date asc, period asc, taskId asc) → déterministe.
 * - Pour chaque occurrence : filtrer agents éligibles (non absents sur la date,
 *   skills requis couverts), choisir celui avec charge pondérée cumulée minimale
 *   (départage par userId lexicographique).
 * - Retourne proposedAssignments, workloadByAgent, equityRatio (1-σ/µ clampé [0..1]),
 *   unassignedOccurrences si aucun agent éligible.
 * - Pure, zéro I/O DB. Les absences et skills doivent être résolus par l'appelant.
 */
@Injectable()
export class PlanningBalancerService {
  balance(input: BalancerInput): BalancerOutput {
    const workload = new Map<string, number>();
    for (const agent of input.agents) {
      workload.set(agent.userId, 0);
    }

    // Tri déterministe (date asc → period asc → taskId asc)
    const occurrences = [...input.occurrences].sort((a, b) => {
      const dateCmp = a.date.getTime() - b.date.getTime();
      if (dateCmp !== 0) return dateCmp;
      const periodCmp = a.period.localeCompare(b.period);
      if (periodCmp !== 0) return periodCmp;
      return a.taskId.localeCompare(b.taskId);
    });

    const proposedAssignments: BalancerProposedAssignment[] = [];
    const unassignedOccurrences: BalancerUnassigned[] = [];

    for (const occ of occurrences) {
      const requiredSkills = input.taskRequiredSkills?.get(occ.taskId) ?? [];
      const absencesByUser = input.absences;

      const eligibles = input.agents.filter((agent) => {
        if (this.isAbsentOn(absencesByUser.get(agent.userId) ?? [], occ.date)) {
          return false;
        }
        if (requiredSkills.length === 0) return true;
        const skills = agent.skills ?? [];
        return requiredSkills.every((s) => skills.includes(s));
      });

      if (eligibles.length === 0) {
        unassignedOccurrences.push({
          taskId: occ.taskId,
          date: occ.date,
          period: occ.period,
          reason: 'NO_ELIGIBLE_AGENT',
        });
        continue;
      }

      // Départage stable : charge asc, puis userId asc (lex)
      const chosen = eligibles
        .slice()
        .sort((x: BalancerAgent, y: BalancerAgent) => {
          const wx = workload.get(x.userId) ?? 0;
          const wy = workload.get(y.userId) ?? 0;
          if (wx !== wy) return wx - wy;
          return x.userId.localeCompare(y.userId);
        })[0];

      proposedAssignments.push({
        taskId: occ.taskId,
        userId: chosen.userId,
        date: occ.date,
        period: occ.period,
        weight: occ.weight,
      });
      workload.set(
        chosen.userId,
        (workload.get(chosen.userId) ?? 0) + occ.weight,
      );
    }

    const workloadByAgent = Array.from(workload.entries())
      .map(([userId, weightedLoad]) => ({ userId, weightedLoad }))
      .sort((a, b) => a.userId.localeCompare(b.userId));

    const loads = workloadByAgent.map((a) => a.weightedLoad);
    const n = loads.length;
    const mean = n > 0 ? loads.reduce((acc, v) => acc + v, 0) / n : 0;
    const variance =
      n > 0
        ? loads.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / n
        : 0;
    const stddev = Math.sqrt(variance);
    const equityRatio =
      mean > 0 ? Math.max(0, Math.min(1, 1 - stddev / mean)) : 1;

    return {
      proposedAssignments,
      workloadByAgent,
      equityRatio,
      unassignedOccurrences,
    };
  }

  private isAbsentOn(absences: BalancerAbsence[], date: Date): boolean {
    const t = date.getTime();
    return absences.some(
      (a) => a.startDate.getTime() <= t && t <= a.endDate.getTime(),
    );
  }
}
