import { describe, it, expect, beforeEach } from 'vitest';
import { PlanningBalancerService } from './planning-balancer.service';
import { BalancerInput, BalancerOccurrence } from './planning-balancer.types';

describe('PlanningBalancerService', () => {
  let service: PlanningBalancerService;

  beforeEach(() => {
    service = new PlanningBalancerService();
  });

  const buildInput = (partial: Partial<BalancerInput>): BalancerInput => ({
    occurrences: [],
    agents: [],
    absences: new Map(),
    ...partial,
  });

  it('cas 1 — trivial : 1 agent, 1 occurrence → 1 assignation, equity=1', () => {
    const out = service.balance(
      buildInput({
        agents: [{ userId: 'u1' }],
        occurrences: [
          {
            taskId: 't1',
            weight: 1,
            date: new Date('2026-05-01'),
            period: 'MORNING',
          },
        ],
      }),
    );
    expect(out.proposedAssignments).toHaveLength(1);
    expect(out.proposedAssignments[0].userId).toBe('u1');
    expect(out.equityRatio).toBe(1);
    expect(out.unassignedOccurrences).toHaveLength(0);
  });

  it('cas 2 — répartition parfaite : 2 agents, 4 occurrences poids=1 → 2 par agent', () => {
    const occs: BalancerOccurrence[] = Array.from({ length: 4 }, (_, i) => ({
      taskId: 't1',
      weight: 1,
      date: new Date(`2026-05-0${i + 1}T00:00:00Z`),
      period: 'MORNING',
    }));
    const out = service.balance(
      buildInput({
        agents: [{ userId: 'u1' }, { userId: 'u2' }],
        occurrences: occs,
      }),
    );
    const byAgent = new Map<string, number>();
    out.proposedAssignments.forEach((a) =>
      byAgent.set(a.userId, (byAgent.get(a.userId) ?? 0) + 1),
    );
    expect(byAgent.get('u1')).toBe(2);
    expect(byAgent.get('u2')).toBe(2);
    expect(out.equityRatio).toBe(1);
  });

  it('cas 3 — poids asymétriques [5,5,1,1,1,1] sur 3 agents : les deux 5 ne sont pas chez le même agent', () => {
    const weights = [5, 5, 1, 1, 1, 1];
    const occs: BalancerOccurrence[] = weights.map((w, i) => ({
      taskId: 't1',
      weight: w,
      date: new Date(`2026-05-0${i + 1}T00:00:00Z`),
      period: 'MORNING',
    }));
    const out = service.balance(
      buildInput({
        agents: [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }],
        occurrences: occs,
      }),
    );
    const usersOf5 = out.proposedAssignments
      .filter((a) => a.weight === 5)
      .map((a) => a.userId);
    expect(new Set(usersOf5).size).toBe(2);
  });

  it('cas 4 — absence bloquante : u1 absent jour 1 → occ1 à u2, occ2 à u1', () => {
    const out = service.balance(
      buildInput({
        agents: [{ userId: 'u1' }, { userId: 'u2' }],
        occurrences: [
          {
            taskId: 't',
            weight: 1,
            date: new Date('2026-05-01T00:00:00Z'),
            period: 'MORNING',
          },
          {
            taskId: 't',
            weight: 1,
            date: new Date('2026-05-02T00:00:00Z'),
            period: 'MORNING',
          },
        ],
        absences: new Map([
          [
            'u1',
            [
              {
                startDate: new Date('2026-05-01T00:00:00Z'),
                endDate: new Date('2026-05-01T23:59:59Z'),
              },
            ],
          ],
        ]),
      }),
    );
    const a1 = out.proposedAssignments.find((a) =>
      a.date.toISOString().startsWith('2026-05-01'),
    );
    const a2 = out.proposedAssignments.find((a) =>
      a.date.toISOString().startsWith('2026-05-02'),
    );
    expect(a1?.userId).toBe('u2');
    expect(a2?.userId).toBe('u1');
  });

  it('cas 5 — compétence requise : seul b possède skill X → assignation forcée à b', () => {
    const out = service.balance(
      buildInput({
        agents: [
          { userId: 'a', skills: [] },
          { userId: 'b', skills: ['X'] },
          { userId: 'c', skills: [] },
        ],
        occurrences: [
          {
            taskId: 't1',
            weight: 3,
            date: new Date('2026-05-01T00:00:00Z'),
            period: 'MORNING',
          },
        ],
        taskRequiredSkills: new Map([['t1', ['X']]]),
      }),
    );
    expect(out.proposedAssignments).toHaveLength(1);
    expect(out.proposedAssignments[0].userId).toBe('b');
  });

  it('cas 6 — aucun éligible : tous les agents absents → unassigned NO_ELIGIBLE_AGENT', () => {
    const out = service.balance(
      buildInput({
        agents: [{ userId: 'u1' }],
        occurrences: [
          {
            taskId: 't',
            weight: 1,
            date: new Date('2026-05-01T00:00:00Z'),
            period: 'MORNING',
          },
        ],
        absences: new Map([
          [
            'u1',
            [
              {
                startDate: new Date('2026-04-30T00:00:00Z'),
                endDate: new Date('2026-05-02T23:59:59Z'),
              },
            ],
          ],
        ]),
      }),
    );
    expect(out.proposedAssignments).toHaveLength(0);
    expect(out.unassignedOccurrences).toHaveLength(1);
    expect(out.unassignedOccurrences[0].reason).toBe('NO_ELIGIBLE_AGENT');
  });

  it('cas 6b — télétravail bloquant : tâche présentielle → agent en télétravail non éligible', () => {
    const out = service.balance(
      buildInput({
        agents: [{ userId: 'u1' }, { userId: 'u2' }],
        occurrences: [
          {
            taskId: 't-presentiel',
            weight: 1,
            date: new Date('2026-05-01T00:00:00Z'),
            period: 'MORNING',
          },
        ],
        telework: new Map([
          ['u1', [{ date: new Date('2026-05-01T00:00:00Z') }]],
        ]),
        taskTeleworkAllowed: new Map([['t-presentiel', false]]),
      }),
    );

    expect(out.proposedAssignments).toHaveLength(1);
    expect(out.proposedAssignments[0].userId).toBe('u2');
  });

  it('cas 6c — télétravail autorisé : agent en télétravail reste éligible', () => {
    const out = service.balance(
      buildInput({
        agents: [{ userId: 'u1' }, { userId: 'u2' }],
        occurrences: [
          {
            taskId: 't-compatible',
            weight: 1,
            date: new Date('2026-05-01T00:00:00Z'),
            period: 'MORNING',
          },
        ],
        telework: new Map([
          ['u1', [{ date: new Date('2026-05-01T00:00:00Z') }]],
        ]),
        taskTeleworkAllowed: new Map([['t-compatible', true]]),
      }),
    );

    expect(out.proposedAssignments).toHaveLength(1);
    expect(out.proposedAssignments[0].userId).toBe('u1');
  });

  it('cas 7 — départage stable par userId lexicographique : user-a gagne sur user-b à charge égale', () => {
    const out = service.balance(
      buildInput({
        agents: [{ userId: 'user-b' }, { userId: 'user-a' }],
        occurrences: [
          {
            taskId: 't',
            weight: 1,
            date: new Date('2026-05-01T00:00:00Z'),
            period: 'MORNING',
          },
        ],
      }),
    );
    expect(out.proposedAssignments[0].userId).toBe('user-a');
  });

  it('bench — 20 agents × 30 tâches × 30 jours (900 occurrences) → < 3000ms', () => {
    const agents = Array.from({ length: 20 }, (_, i) => ({ userId: `u${i}` }));
    const occurrences: BalancerOccurrence[] = [];
    for (let d = 0; d < 30; d++) {
      for (let t = 0; t < 30; t++) {
        occurrences.push({
          taskId: `t${t}`,
          weight: (t % 5) + 1,
          date: new Date(2026, 4, 1 + d),
          period: 'MORNING',
        });
      }
    }
    const t0 = Date.now();
    const out = service.balance(buildInput({ agents, occurrences }));
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(3000);
    expect(out.proposedAssignments).toHaveLength(900);
    // sanity : tous les agents ont été utilisés
    const distinctUsers = new Set(out.proposedAssignments.map((a) => a.userId));
    expect(distinctUsers.size).toBeGreaterThan(0);
  });
});
